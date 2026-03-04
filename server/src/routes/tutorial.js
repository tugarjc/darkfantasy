const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { TUTORIAL_QUESTS } = require('../game/tutorial');

const router = Router();

// ── GET /api/tutorial ── Get tutorial progress
router.get('/', authenticateToken, async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT * FROM tutorial_progress WHERE player_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Create tutorial entry
      const quests = TUTORIAL_QUESTS.map(q => ({
        id: q.id,
        completed: false,
        claimed: false,
        progress: 0,
      }));
      await pool.query(
        'INSERT INTO tutorial_progress (player_id, quests) VALUES ($1, $2) ON CONFLICT (player_id) DO NOTHING',
        [req.user.id, JSON.stringify(quests)]
      );
      result = await pool.query(
        'SELECT * FROM tutorial_progress WHERE player_id = $1',
        [req.user.id]
      );
    }

    const row = result.rows[0];
    const progress = typeof row.quests === 'string' ? JSON.parse(row.quests) : row.quests;

    const quests = TUTORIAL_QUESTS.map((def, i) => ({
      ...def,
      completed: progress[i]?.completed || false,
      claimed: progress[i]?.claimed || false,
      progress: progress[i]?.progress || 0,
    }));

    res.json({ quests, tutorialComplete: row.completed || false });
  } catch (err) {
    console.error('Tutorial get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/tutorial/progress ── Update quest progress
router.post('/progress', authenticateToken, async (req, res) => {
  const { questId, amount = 1 } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId requis' });

  const questIndex = TUTORIAL_QUESTS.findIndex(q => q.id === questId);
  if (questIndex === -1) return res.status(400).json({ error: 'Quête inconnue' });

  try {
    const result = await pool.query(
      'SELECT * FROM tutorial_progress WHERE player_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tutorial non initialisé' });

    const row = result.rows[0];
    const progress = typeof row.quests === 'string' ? JSON.parse(row.quests) : row.quests;
    const quest = TUTORIAL_QUESTS[questIndex];

    if (progress[questIndex].completed) {
      return res.json({ quests: progress, alreadyComplete: true });
    }

    // Handle special quest type: complete_all_previous
    if (quest.objective.type === 'complete_all_previous') {
      const allPrevDone = progress.slice(0, questIndex).every(q => q.completed);
      if (allPrevDone) {
        progress[questIndex].completed = true;
        progress[questIndex].progress = 1;
      }
    } else {
      progress[questIndex].progress = (progress[questIndex].progress || 0) + amount;
      const target = quest.objective.count || quest.objective.level || 1;
      if (progress[questIndex].progress >= target) {
        progress[questIndex].completed = true;
      }
    }

    const allDone = progress.every(q => q.completed);
    await pool.query(
      'UPDATE tutorial_progress SET quests = $2, completed = $3 WHERE player_id = $1',
      [req.user.id, JSON.stringify(progress), allDone]
    );

    res.json({ quests: progress, tutorialComplete: allDone });
  } catch (err) {
    console.error('Tutorial progress error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/tutorial/claim ── Claim quest reward
router.post('/claim', authenticateToken, async (req, res) => {
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId requis' });

  const questIndex = TUTORIAL_QUESTS.findIndex(q => q.id === questId);
  if (questIndex === -1) return res.status(400).json({ error: 'Quête inconnue' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM tutorial_progress WHERE player_id = $1 FOR UPDATE',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tutorial non initialisé' });
    }

    const progress = typeof result.rows[0].quests === 'string'
      ? JSON.parse(result.rows[0].quests) : result.rows[0].quests;

    if (!progress[questIndex].completed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Quête non complétée' });
    }
    if (progress[questIndex].claimed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Récompense déjà réclamée' });
    }

    const reward = TUTORIAL_QUESTS[questIndex].reward;

    // Get primary circle
    const circle = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cercle non trouvé' });
    }

    // Apply rewards
    if (reward.iron > 0 || reward.essence > 0 || reward.souls > 0) {
      await client.query(
        'UPDATE resources SET iron = iron + $2, essence = essence + $3, souls = souls + $4 WHERE circle_id = $1',
        [circle.rows[0].id, reward.iron, reward.essence, reward.souls]
      );
    }
    if (reward.relics > 0 || reward.score > 0) {
      await client.query(
        'UPDATE players SET relics = relics + $2, score = score + $3 WHERE id = $1',
        [req.user.id, reward.relics, reward.score]
      );
    }

    progress[questIndex].claimed = true;
    await client.query(
      'UPDATE tutorial_progress SET quests = $2 WHERE player_id = $1',
      [req.user.id, JSON.stringify(progress)]
    );

    await client.query('COMMIT');
    res.json({ message: 'Récompense réclamée', reward });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Tutorial claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
