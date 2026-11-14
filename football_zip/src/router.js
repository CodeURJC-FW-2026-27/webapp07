import express from "express";
import mustacheExpress from "mustache-express";
import multer from "multer";
import { MongoClient } from "mongodb";

const router = new express.Router();

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('laliga');
const equipos = db.collection('equipos');

router.get('/', (req, res) => {
    res.redirect('/index/1');
});

router.get('/index', (req, res) => {
    res.redirect('/index/1');
});

router.get('/index/:page', async (req, res) => {
    await client.connect();
    let page = req.params.page;
    let salto = (page - 1) * 6;
    const equiposList = await equipos.find().sort({ puntos: -1 }).skip(salto).limit(6).toArray();
    let numPages = await equipos.countDocuments();
    let hayEquipos;
    if (numPages === 0) {
        hayEquipos = false;
    }
    else{
        hayEquipos = true;
    }
    if (numPages % 6 !== 0) {
        numPages = numPages / 6 + 1;
    }
    else if (numPages === 0) {
        numPages = 1;
    }
    else
        numPages = numPages / 6;
    let pages = [numPages];
    let i = 0;
    while (pages[i]) {
        pages[i] = { numero: i + 1, activa: i + 1 === Number(page) };
        i++;
    }
    res.render('index', { equipos: equiposList, hayEquipos: hayEquipos, page: page, pages: pages });
});

router.get('/formularioEquipo', (req, res) => {
    res.render('formularioEquipo');
});

router.post('/guardarEquipo', multer({ dest: 'public/uploads/' }).single('imagen'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Debes seleccionar una imagen para el escudo.');
    }
    await client.connect();
    const nuevoEquipo = {
        nombre: req.body.nombre,
        ciudad: req.body.ciudad,
        fundacion: req.body.fecha,
        estadio: req.body.estadio,
        biografia: req.body.biografia,
        temporadas: Number(req.body.temporadas || 0),
        ligas: Number(req.body.ligas || 0),
        mejorPosicion: req.body.mejorPosicion ? Number(req.body.mejorPosicion) : null,
        dato: req.body.dato,
        puntos: 0,
        escudo: `/public/uploads/${req.file.filename}`
    };
    await equipos.insertOne(nuevoEquipo);
    res.redirect('/index/1');
});

export default router;
