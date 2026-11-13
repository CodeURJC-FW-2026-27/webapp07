import express from "express";
import mustacheExpress from "mustache-express";
import multer from "multer";
import { MongoClient } from "mongodb";

const router = new express.Router();

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('laliga');
const equipos = db.collection('equipos');

router.get('/', async (req, res) => {
    await client.connect();
    const equiposList = await equipos.find().toArray();
    res.render('index', { equipos: equiposList });
});

export default router;