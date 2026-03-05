import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';
import session from 'express-session';

const app = express();
const port = process.env.PORT || 3000;
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This is required by almost all cloud databases
  }
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
// Sets up the session cookie
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS, false for localhost
}));

// This makes the "isAuthenticated" variable available to EVERY .ejs file automatically!
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isAuthenticated || false;
    next();
});

// The Bodyguard Function: Kicks out anyone who tries to bypass the UI
function requireAuth(req, res, next) {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.send('<h1>Access Denied. You are not Shorya!</h1><a href="/">Go Back</a>');
}

app.get('/', async(req, res) => {
  try{
  const result=await db.query("select * from books order by id asc");
  const books=result.rows;
  res.render('index.ejs',{books : books});
  }catch(err){
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/book/:id', async(req, res) => {
  try{
  const bookId=req.params.id;
  const result=await db.query("select * from books where id=$1", [bookId]);
  const book=result.rows[0];
  res.render('bookDetail.ejs',{book : book});
  }catch(err){
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/edit/:id', requireAuth,async(req,res) =>{
try{
  const bookId=req.params.id;
  const newReview=req.body.updatedReview;
  await db.query("update books SET review=$1 where id=$2",[newReview,bookId]);
  res.redirect(`/book/${bookId}`);
}catch (err) {
    console.error("Database Error:", err); 
    res.send("Error updating");
  }
});

app.get('/search-page', requireAuth, (req, res) => {
    res.render('search.ejs'); 
});

app.post('/search', async (req, res) => {
    const query = req.body.query;
    try {
        const response = await axios.get(`https://openlibrary.org/search.json?q=${query}`);
        const books = response.data.docs.slice(0, 20); 
        res.render('search.ejs', { books: books });
    } catch (err) {
        console.error("API Error:", err);
        res.send("Error fetching books");
    }
});

app.post('/new', (req, res) => {
    const { title, author, cover_id } = req.body;
    res.render('new.ejs', { title, author, cover_id });
});

app.get('/add', (req, res) => {
    res.render('new.ejs');
});

app.post('/add', requireAuth, async (req, res) => {
    const title = req.body.title;
    const author = req.body.author;
    const rating = req.body.rating;
    const review = req.body.review;
    const cover_id = req.body.cover_id;

    try {
        await db.query(
            "INSERT INTO books (title, author, rating, review, cover_id) VALUES ($1, $2, $3, $4, $5)",
            [title, author, rating, review, cover_id]
        );
        res.redirect('/');
    } catch (err) {
        console.error("Error inserting book:", err);
        res.send("Error adding book to database");
    }
});

app.post('/delete/:id', requireAuth,async(req,res)=>{
  const bookId=req.params.id;
  try{
    await db.query("DELETE FROM books WHERE id=$1",[bookId])
    res.redirect('/');
  }catch(err){
    console.error("Database Error:", err);
    res.send("Error deleting the book.");
  }
})

// Shows the secret login page
app.get('/login', (req, res) => {
    res.render('login.ejs');
});

// Checks your password
app.post('/login', (req, res) => {
    const password = req.body.password;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAuthenticated = true; // Gives you the VIP wristband!
        res.redirect('/');
    } else {
        res.send('<h1>Wrong Password!</h1><a href="/login">Try Again</a>');
    }
});

// Lets you log out to test the public view
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
