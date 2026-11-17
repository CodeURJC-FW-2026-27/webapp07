import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as LaLiga from './board.js';

const router = express.Router();
export default router;
    
const upload = multer({ dest: LaLiga.UPLOADS_FOLDER })
router.get('/', (req, res) => {
    res.redirect('/index/1');
});

router.get('/index', (req, res) => {
    res.redirect('/index/1');
});

router.get('/index/:page', async (req, res) => {
    let page = req.params.page;
    let salto = (page - 1) * 6;
    const equiposList = await LaLiga.getEquipos(salto);
    let numPages = await LaLiga.getEquiposCount();
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

router.post('/guardarEquipo', upload.single('imagen'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Debes seleccionar una imagen para el escudo.');
    }
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
        escudo: req.file?.filename
    };
    await LaLiga.addequipo(nuevoEquipo);
    res.redirect('/index/1');
});
router.get('/equipo/:id/imagen', async (req, res) => {
    const equipo = await LaLiga.getEquipo(req.params.id);

    if (!equipo || !equipo.escudo) {
        return res.status(404).send('Imagen no encontrada');
    }

    res.sendFile(equipo.escudo, {
        root: LaLiga.UPLOADS_FOLDER
    });
});    
