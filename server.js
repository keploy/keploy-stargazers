const express = require('express');
const redis = require('redis');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.log('Redis Client Error', err));
redisClient.connect();

app.post('/api/stargazers', async (req, res) => {
  const { owner, repo, stargazers } = req.body;
  const key = `stargazers:${owner}:${repo}`;
  
  try {
    const pipeline = redisClient.multi();
    stargazers.forEach(s => pipeline.rPush(key, JSON.stringify(s)));
    await pipeline.exec();
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send(err.message);
  }
}); 
app.get('/api/clear', async (req, res) => {
    const { owner, repo } = req.query;
    const key = `stargazers:${owner}:${repo}`;
    
    try {
      await redisClient.del(key);
      res.status(200).send('OK');
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
  
app.delete('/api/stargazers', async (req, res) => {
  const { owner, repo } = req.query;
  const key = `stargazers:${owner}:${repo}`;
  
  try {
    await redisClient.del(key);
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/stargazers', async (req, res) => {
  const { owner, repo } = req.query;
  const key = `stargazers:${owner}:${repo}`;
   try {
    const data = await redisClient.lRange(key, 0, -1);
    console.log(data);
    res.json(data.map(JSON.parse));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
