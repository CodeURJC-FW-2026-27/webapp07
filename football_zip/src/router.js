import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as LaLiga from './board.js';

const router = express.Router();
export default router;
const allEquipos = await LaLiga.equipos.find().toArray();
const hayEquipos = allEquipos.length !== 0;
    
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
    res.render('index', { allEquipos: allEquipos, equipos: equiposList, hayEquipos: hayEquipos, page: page, pages: pages });
});

router.get('/formularioEquipo', (req, res) => {
    res.render('formularioEquipo', {allEquipos: allEquipos, hayEquipos: hayEquipos});
});

router.post('/guardarEquipo', upload.single('imagen'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Debes seleccionar una imagen para el escudo.');
    }
    const teamName = (req.body.nombre ?? '').trim();
    const city = (req.body.ciudad ?? '').trim();
    const president = (req.body.presidente ?? '').trim();
    const stadium = (req.body.estadio ?? '').trim();
    const description = (req.body.biografia ?? '').trim();
    const foundationDate = (req.body.fecha ?? '').trim();

    const points = Number(req.body.puntos || 0);
    const seasons = Number(req.body.temporadas || 0);
    const leagueTitles = Number(req.body.ligas || 0);
    const bestPosition = req.body.mejorPosicion
        ? Number(req.body.mejorPosicion)
        : null;

    const parsedDate = new Date(`${foundationDate}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);
    const validDate =
        /^\d{4}-\d{2}-\d{2}$/.test(foundationDate) &&
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === foundationDate &&
        foundationDate <= today;

    const isIntegerInRange = (value, min, max) =>
        Number.isInteger(value) && value >= min && value <= max;

    function showError(message, status = 400) {
        return res.status(status).render('error', {
            message,
            returnUrl: '/formularioEquipo',
            returnLabel: 'Volver al formulario'
        });
    }

    if (!teamName || !city || !president || !stadium || !foundationDate) {
        return showError('Rellena el nombre, la ciudad, el presidente, el estadio y la fecha.');
    }

    if (!/^\p{Lu}/u.test(teamName)) {
        return showError('El nombre del equipo debe empezar por mayúscula.');
    }

    if (!validDate) {
        return showError('Introduce una fecha de fundación válida que no sea futura.');
    }

    if (description.length < 10 || description.length > 1000) {
        return showError('La biografía debe tener entre 10 y 1000 caracteres.');
    }

    if (
        !isIntegerInRange(points, 0, 150) ||
        !isIntegerInRange(seasons, 0, 200) ||
        !isIntegerInRange(leagueTitles, 0, 200)
    ) {
        return showError('Revisa los puntos (0–150), las temporadas (0–200) y las ligas (0–200).');
    }

    if (bestPosition !== null && !isIntegerInRange(bestPosition, 1, 20)) {
        return showError('La mejor posición debe estar entre 1 y 20.');
    }

    const existingTeam = await LaLiga.equipos.findOne({ nombre: teamName });

    if (existingTeam) {
        return showError('Ya existe un equipo con ese nombre.', 409);
    }
        const nuevoEquipo = {
            nombre: teamName,
            ciudad: req.body.ciudad,
            fundacion: req.body.fecha,
            presidente: req.body.presidente,
            estadio: req.body.estadio,
            biografia: req.body.biografia,
            puntos: Number(req.body.puntos || 0),
            posicion: 0,
            temporadas: Number(req.body.temporadas || 0),
            ligas: Number(req.body.ligas || 0),
            mejorPosicion: req.body.mejorPosicion ? Number(req.body.mejorPosicion) : null,
            dato: req.body.dato,
            escudo: req.file?.filename,
            jugadores: new Array()
        };
        const { insertedId } = await LaLiga.addequipo(nuevoEquipo);
        const equiposList = await LaLiga.equipos.find().sort({ puntos: -1 }).toArray();
        for (let i = 0; i < equiposList.length; i++) {
            await LaLiga.equipos.updateOne({ _id: equiposList[i]._id }, { $set: { posicion: i + 1 } });
        }
        res.render('confirmacion', {
            message: 'El equipo se ha creado correctamente.',
            returnUrl: `/equipo/${insertedId}`,
            returnLabel: 'Ver equipo'
        });
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

router.get('/equipo/:id', async (req, res) => {
    const equipo = await LaLiga.getEquipo(req.params.id);
    if (!equipo) {
        return res.status(404).send('Equipo no encontrado');
    }
    res.render('equipo', { equipo: equipo, allEquipos: allEquipos, hayEquipos: hayEquipos });
});

router.post('/nuevoJugador/:id', async (req, res) => {
    let jugador = {
        _id: new ObjectId(),
        nombre: req.body.nombre,
        nacionalidad: req.body.nacionalodad,
        edad: req.body.edad,
        posicion: req.body.posicion,
        partidos: req.body.partidos,
        goles: req.body.goles,
        asistencias: req.body.asistencias
    };
    await LaLiga.equipos.updateOne({ _id: req.params.id }, { $push: { jugadores: jugador } });
    const equipo = await LaLiga.getEquipo(req.params.id);
    res.redirect('/equipo/' + req.params.id, {equipo: equipo, allEquipos: allEquipos, hayEquipos: hayEquipos});
});