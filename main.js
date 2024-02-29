require("dotenv").config();
const express = require('express');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getFirestore,updateDoc, collection, query, where,addDoc,deleteDoc,getDoc, getDocs,doc,serverTimestamp, FirestoreError } = require("firebase/firestore");
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const firebaseConfig = {
  apiKey: "AIzaSyBprfhWzddARMBeCKqnh88q39WuaW_1l78",
  authDomain: "on-the-grid-news.firebaseapp.com",
  projectId: "on-the-grid-news",
  storageBucket: "on-the-grid-news.appspot.com",
  messagingSenderId: "210114192310",
  appId: "1:210114192310:web:c6b838655e863d2ef2d717",
  measurementId: "G-7YT39HKG1Y"
};

const firebaseApp = initializeApp(firebaseConfig);
const  db  = getFirestore(firebaseApp);


//login endpoint
app.post("/login", async (req, res) => {
  // Array to store recent logins locally within the login endpoint
  const { email, password } = req.body;
  try {
    // Query the Firestore collection to find a user with the provided email and password
    const q = query(collection(db, 'users'), where('email', '==', email), where('password', '==', password));
    const querySnapshot = await getDocs(q);
    // Check if any user matches the provided credentials
    if (!querySnapshot.empty) {
      // User found, extract user data
      const user = querySnapshot.docs[0].data();
      const userId = querySnapshot.docs[0].id; // Firestore-generated ID
      // Respond with success and the generated token as before
      const token = jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET);
      res.json({ success: true, token});
    } else {
      // No matching user found, respond with error
      res.status(400).json({ success: false, message: "Error logging in. Invalid credentials." });
    }
  } catch (error) {
    console.error("Error checking credentials: ", error);
    res.status(500).json({ success: false, message: "Error checking credentials" });
  }
});


//get the token and the user data if secceful
 
  const authenticateMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
  
  
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
  
    jwt.verify(token.split(' ')[1], process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.error("Error verifying token:", err);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
  
      // Attach the decoded data to the request for further processing
      req.user = decoded;
      next();
    });
  };


  //get profile_data
app.get('/user-profile', authenticateMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('User ID:', userId);

    // Construct a DocumentReference using the user ID
    const userDocRef = doc(collection(db, 'users'), userId);

    // Fetch the document data using getDoc()
    const docSnapshot = await getDoc(userDocRef); // Use getDoc() here

    // Check if the document exists
    if (docSnapshot.exists()) { // Use docSnapshot.exists()
      const userData = docSnapshot.data();
      res.json({ success: true, user: userData });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user data: ", error);
    res.status(500).json({ success: false, message: "Error fetching user data" });
  }
});


//add user
  app.post("/user", async (req, res) => {
    const {
      email: email,
      fullName: fullName,
      cellNumber: cellNumber,
      password: password,
      editor: editor,
    } = req.body;
  
    try {
      // Add branch to Firestore
      const docRef = await addDoc(collection(db, 'users'), {
          email: email,
          fullName: fullName,
          cellNumber: cellNumber,
          password: password,
          editor:editor,
          date_created: new Date(),
      });
  
      res.status(201).json({
        message: "Acoount created successfully",
        stuffId: docRef.id,
      });
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  //ceate article

   app.post("/editor", async (req, res) => {
    const {
      newstype:newstype,
      summary_text:summary_text,
      headlings:headlings,
      Img_url: Img_url,
      author: author,
      text: text
    } = req.body;
  
    try {
      // Add branch to Firestore
      const docRef = await addDoc(collection(db, 'stories'), {
        newstype:newstype,
        summary_text:summary_text,
        headlings:headlings,
        Img_url: Img_url,
        author:author,
        text:text,
        date_created: new Date().toISOString()
      });
  
      res.status(201).json({
        message: "article created successfully",
        stuffId: docRef.id,
      });
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


app.post('/create', async (req, res) => {
    // Extract data from the request body
    const { news_url, newstype, author,headlings,Img_url } = req.body;

    try {
        // Send request to Flask API with news_url and class_name
        const flaskResponse = await fetch('http://localhost:5000/api/scrape/news', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ news_url }),
        });

        // Check if the request to Flask API was successful
        if (flaskResponse.ok) {
            // Parse the response from Flask API
            const flaskData = await flaskResponse.json();

            // Attach newstype to the data received from Flask
            const dataWithNewstype = { ...flaskData, newstype, author,headlings,Img_url };

            // Add current date to the data
            dataWithNewstype.date_created = new Date().toISOString();

            // Store the data in Firebase
            const docRef = await addDoc(collection(db, 'stories'), dataWithNewstype);

            // Respond with success message and data
            res.status(200).json({ message: 'Story created successfully', data: dataWithNewstype });
        } else {
            // If Flask API request failed, respond with error message
            res.status(flaskResponse.status).json({ error: 'Failed to fetch data from Flask API' });
        }
    } catch (error) {
        // If an error occurs during the process, respond with error message
        console.error('Error during creation:', error);
        res.status(500).json({ error: 'An error occurred during creation' });
    }
});







 //get stories


app.get("/articles", async (req, res) => {
  try {
    const q = query(collection(db, 'stories'));
    const querySnapshot = await getDocs(q);

    const articles = querySnapshot.docs.map(doc => {
      return {
        articleId: doc.id, // Firebase-generated ID
        ...doc.data(), // article data
      };
    });

    res.json({ success: true, articles }); // Corrected to return 'articles' instead of 'stories'
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ success: false, message: "Error fetching articles" });
  }
});

app.post("/remove-article/:id/action", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  console.log('Received delete request for ID:', id);

  try {
    if (action === 'delete') {
      // Delete the product from Firestore
      const articleRef = doc(db, 'stories', id);
      await deleteDoc(articleRef);

      res.status(200).json({ success: true, message: 'article deleted successfully' });
    } else {
      // Handle other actions if needed
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ success: false, message: 'Error deleting article' });
  }
});

// Route to handle TTS request

app.post('/synthesize', async (req, res) => {
  const text = req.body.text

  // Updated this based on Elias feedback
  // As this change will allow the user to pass 0 as a value, if no text is set in the text variable,
  // text will be 0 and the condition will be false so "0" will be used to do TTS.

  // Previous condition
  // if (text === undefined || text === null || text === '' || text == 0) {

  if (!text) {
    res.status(400).send({ error: 'Text is required.' })
    return
  }

  const voice =
    req.body.voice == 0
      ? '21m00Tcm4TlvDq8ikWAM'
      : req.body.voice || '21m00Tcm4TlvDq8ikWAM'

  const voice_settings =
    req.body.voice_settings == 0
      ? {
          stability: 0.75,
          similarity_boost: 0.75,
        }
      : req.body.voice_settings || {
          stability: 0.75,
          similarity_boost: 0.75,
        }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        text: text,
        voice_settings: voice_settings,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          accept: 'audio/mpeg',
          'xi-api-key': "a2a22ef8034d6665de94677dcb66be36",
        },
        responseType: 'arraybuffer',
      }
    )

    const audioBuffer = Buffer.from(response.data, 'binary')
    const base64Audio = audioBuffer.toString('base64')
    const audioDataURI = `data:audio/mpeg;base64,${base64Audio}`
    res.send({ audioDataURI })
  } catch (error) {
    console.error(error)
    res.status(500).send('Error occurred while processing the request.')
  }
})










app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
