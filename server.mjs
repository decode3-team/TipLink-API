import express from 'express';
import cors from 'cors';

import { TipLink } from './dist/index.js'; // Import the TipLink class

const app = express();
const port = 3001;
app.use(cors());

app.get('/tiplink/create', async (req, res) => {
  try {
    const tipLink = await TipLink.create();
    res.json({ message: 'TipLink created', data: tipLink });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error creating TipLink', error: error.message });
  }
});

app.get('/tiplink/fromLink', async (req, res) => {
  const { link } = req.query;
  try {
    const tipLink = await TipLink.fromLink(link);
    res.json({ message: 'TipLink from link', data: tipLink });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching TipLink', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
