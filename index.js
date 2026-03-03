import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';

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

app.post('/edit/:id',async(req,res) =>{
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

app.get('/search-page', (req, res) => {
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

app.post('/add', async (req, res) => {
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

app.post('/delete/:id',async(req,res)=>{
  const bookId=req.params.id;
  try{
    await db.query("DELETE FROM books WHERE id=$1",[bookId])
    res.redirect('/');
  }catch(err){
    console.error("Database Error:", err);
    res.send("Error deleting the book.");
  }
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
