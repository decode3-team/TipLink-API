import express from 'express';
import cors from 'cors';
import { stringify } from 'flatted';
import { MongoClient } from 'mongodb';

import { TipLink, TipLinkClient } from './dist/index.js'; // Import the TipLink class
import { Keypair } from '@solana/web3.js';

const app = express();
const port = 3001;
const main_link = 'https://tiplink.io/i';
app.use(cors());
app.use(express.json());

const mongoURI = 'mongodb://mongo:MiBgsUXZBCKiYSJGJdiJSSlhlCcNeHiI@junction.proxy.rlwy.net:25438'; // Replace with your MongoDB URI
const dbName = 'test'; // Replace with your database name

let db;

const connectToMongo = async () => {
  const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  db = client.db(dbName);
  console.log('Connected to MongoDB');
};

connectToMongo().catch(console.error);

app.get('/frenslink/create', async (req, res) => {
  try {
    const tipLink = await TipLink.create();
    res.json({ message: 'FresLink created', data: tipLink });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error creating FresLink', error: error.message });
  }
});

app.get('/frenslink/fromLink', async (req, res) => {
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

app.get('/freslink/fromURL', async (req, res) => {
  const { link } = req.query;
  
  try {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const dispenser = await db.collection('dispenserData').findOne({ dispenserURL: link });
    if (!dispenser) {
      return res.status(404).json({ message: 'Dispenser URL not found.' });
    }

    const isClaimedByIP = dispenser.claimedBy.includes(clientIP);
    if (isClaimedByIP) {
      return res.status(400).json({ message: 'You have already claimed this link', claimedByIP: true });
    }

    const newTipLinks = JSON.parse(dispenser.newTipLinks);
    const availableTipLink = newTipLinks.find(tipLink => !tipLink.isClaimed);

    if (!availableTipLink) {
      return res.status(404).json({ message: 'No available unclaimed tip links found.' });
    }

    // availableTipLink.isClaimed = true;
    // await db.collection('dispenserData').updateOne(
    //   { dispenserURL: link },
    //   {
    //     $set: { newTipLinks: JSON.stringify(newTipLinks) },
    //     $push: { claimedBy: clientIP }
    //   }
    // );

    res.json({ message: 'Link fetched successfully', tipLink: availableTipLink, token: dispenser.token, symbol: dispenser.symbol });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching DispenserLink', error: error.message });
  }
});

app.post('/frenslink/claim', async (req, res) => {
  const { tipLinkUrl } = req.body;
  const { link } = req.query;

  try {
    // Find the TipLink document that contains the tipLinkUrl
    const tipLink = await db.collection('dispenserData').findOne({ dispenserURL: link });

    if (!tipLink) {
      return res.status(404).send({ message: 'Campaign not found' });
    }

    let oldTipLinksArray = JSON.parse(tipLink.newTipLinks);
    // Update claimedBy array with the wallet address and set the isClaimed flag
    let newTipLinksArray = oldTipLinksArray.map((link) => {
      if (link.url === tipLinkUrl && !link.isClaimed) {
        link.isClaimed = true;
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        tipLink.claimedBy.push(clientIP);
      }
      return link;
    });

    // Save the updated document back to the database
    await db.collection('dispenserData').updateOne(
      { _id: tipLink._id }, // Find the document by its ID
      {
        $set: {
          newTipLinks: JSON.stringify(newTipLinksArray),
          claimedBy: tipLink.claimedBy
        }
      }
    );

    res.status(200).send({ message: 'TipLink claimed successfully!' });
  } catch (err) {
    console.error('Error updating TipLink:', err);
    res.status(500).send({ message: 'Error updating TipLink' });
  }
});

app.post('/frenslink/client/create/dispenserURL', async (req, res) => {
  const { apikey, version, tipLinks, token, symbol } = req.body;
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
    const dbTipLinks = tipLinks.map((tipLink) => ({
      url: tipLink.url,
      amount: tipLink.amount,
      isClaimed: false,
    }));

    await campaign.addEntries(newTipLinks);

    const dispenser = await campaign.dispensers.create({
      useCaptcha: false, // optional: default true
      useFingerprint: true, // optional: default true
      unlimitedClaims: false, // optional: default false // WARNING: this is global per campaign and affects all dispensers for that campaign
    });

    const dispenserURL = dispenser.url.href;
    const updatedURL = dispenserURL.replace('tiplink.io/f', 'solana-tip-link.vercel.app/claim');
    dispenser.url = updatedURL; // Or re-create a URL object if necessary

    const collection = db.collection('dispenserData'); // Replace 'dispenserData' with your desired collection name
    const result = await collection.insertOne({
      dispenserURL: updatedURL,
      newTipLinks: JSON.stringify(dbTipLinks),
      claimedBy: [],
      token,
      symbol,
      createdAt: new Date(),
    });

    res.json({ message: 'success', data: dispenser.url });
  } catch (error) {
    res.status(500).json({ message: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
