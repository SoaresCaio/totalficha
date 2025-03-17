require('dotenv').config(); // Add this line to load environment variables
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();
const port = 5000;

// Enable CORS for the frontend (update with your Vercel client URL after deployment)
app.use(cors({ origin: 'http://localhost:5173' })); // Temporary for local testing
app.use(express.json());

// Initialize Firebase Admin with environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}
const db = admin.firestore();

// Test Firestore connection
async function testFirestore() {
  try {
    await db.collection('test').doc('connection').set({ connected: true });
    console.log('Firestore connection test successful');
  } catch (error) {
    console.error('Firestore connection test failed:', error);
  }
}
testFirestore();

// POST endpoint to save workouts
app.post('/api/workouts', async (req, res) => {
  const { code, workoutName, exercises } = req.body;
  if (!code || !workoutName || !exercises) {
    return res.status(400).json({ error: 'Missing code, workoutName, or exercises' });
  }
  try {
    // Normalize the code to lowercase
    const normalizedCode = code.toLowerCase();

    // Save the workout (creates new document or updates existing one)
    await db.collection('workouts').doc(normalizedCode).set(
      {
        workouts: {
          [workoutName]: { exercises }
        }
      },
      { merge: true }
    );
    console.log(`Workout ${workoutName} saved for code: ${normalizedCode}`);
    res.status(200).json({ message: 'Workout saved' });
  } catch (error) {
    console.error('Error saving workout:', error);
    res.status(500).json({ error: error.message || 'Failed to save' });
  }
});

// GET endpoint to fetch all workouts for a code
app.get('/api/workouts/:code', async (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }
  try {
    const normalizedCode = code.toLowerCase(); // Normalize code for lookup
    const doc = await db.collection('workouts').doc(normalizedCode).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`Workouts fetched for code: ${normalizedCode}`);
      res.status(200).json({ workouts: data.workouts || {} });
    } else {
      console.log(`No workouts found for code: ${normalizedCode}`);
      res.status(404).json({ error: 'Workouts not found' });
    }
  } catch (error) {
    console.error('Error fetching workouts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch' });
  }
});

// DELETE endpoint to remove a specific workout
app.delete('/api/workouts/:code/:workoutName', async (req, res) => {
  const { code, workoutName } = req.params;
  if (!code || !workoutName) {
    return res.status(400).json({ error: 'Missing code or workoutName' });
  }
  try {
    const normalizedCode = code.toLowerCase(); // Normalize code for deletion
    // Use Firestore's update to remove the workoutName field from the workouts map
    await db.collection('workouts').doc(normalizedCode).update({
      [`workouts.${workoutName}`]: admin.firestore.FieldValue.delete()
    });
    console.log(`Workout ${workoutName} deleted for code: ${normalizedCode}`);
    res.status(200).json({ message: 'Workout deleted' });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});