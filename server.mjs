import express from 'express';
import cors from 'cors';
import { stringify } from 'flatted';

import { TipLink, TipLinkClient } from './dist/index.js'; // Import the TipLink class
import { Keypair } from '@solana/web3.js';

const app = express();
const port = 3001;
const main_link = 'https://tiplink.io/i';
app.use(cors());
app.use(express.json());

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
    const decodedLink = main_link + '#' + link; // Decode the link
    const tipLink = await TipLink.fromLink(decodedLink);
    res.json({ message: 'TipLink from link', data: tipLink });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching TipLink', error: error.message });
  }
});

app.post('/tiplink/client/create/dispenserURL', async (req, res) => {
  const { apikey, version, tipLinks } = req.body;

  try {
    const client = await TipLinkClient.init(apikey, version);
    const campaign = await client.campaigns.create({
      name: 'Campaign test',
      description: 'longer string description', // optional
      // themeId: 1, // optional Preimum feature to attach a theme to campaign
    });
    const newTipLinks = tipLinks.map((tipLink) => ({
      ...tipLink,
      keypair: Object.assign({}, tipLink.keypair._keypair),
    }));

    await campaign.addEntries(newTipLinks);

    const dispenser = await campaign.dispensers.create({
      useCaptcha: false, // optional: default true
      useFingerprint: true, // optional: default true
      unlimitedClaims: false, // optional: default false // WARNING: this is global per campaign and affects all dispensers for that campaign
    });

    const dispenserURL = dispenser.url.href;
    const updatedURL = dispenserURL.replace('tiplink', 'multilink');
    dispenser.url = updatedURL; // Or re-create a URL object if necessary

    res.json({ message: 'success', data: dispenser.url });
  } catch (error) {
    res.status(500).json({ message: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
