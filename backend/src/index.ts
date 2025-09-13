import express from 'express';
import { PrismaClient } from './generated/prisma/index.js';

const app = express();
const prisma = new PrismaClient();

app.get('/api/users', async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
