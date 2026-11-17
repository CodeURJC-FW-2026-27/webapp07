import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as LaLiga from './board.js';
import { ObjectId } from 'mongodb';

const router = express.Router();
export default router;
let allEquipos = await LaLiga.equipos.find().toArray();
let hayEquipos = allEquipos.length !== 0;
    
const upload = multer({ dest: LaLiga.UPLOADS_FOLDER })
function readText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function readOptionalNumber(value, defaultValue = 0) {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    return typeof value === 'string' ? Number(value) : NaN;
}

function isIntegerInRange(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
}

function renderFormError(res, message, returnUrl, status = 400) {
    return res.status(status).render('error', {
        message,
        returnUrl,
        returnLabel: 'Volver al formulario'
    });
}
router.get('/', (req, res) => {
    res.redirect('/index/1');
});

router.get('/index', (req, res) => {
    res.redirect('/index/1');
});

router.get('/buscar', async (req, res) => {
    const busqueda = (req.query.busqueda ?? '').trim();

    if (!busqueda) {
        return res.redirect('/index/1');
    }

    const equipo = await LaLiga.equipos.findOne({
        nombre: { $regex: `^${busqueda}$`, $options: 'i' }
    });

    if (equipo) {
        return res.redirect(`/equipo/${equipo._id}`);
    }

    return res.status(404).render('error', {
        message: `No se encontró el equipo "${busqueda}".`,
        returnUrl: '/index/1',
        returnLabel: 'Volver al inicio'
    });
});

router.get('/index/:page', async (req, res) => {
    const pageSize = 6;
    const requestedPage = Number(req.params.page);

    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
        return res.redirect('/index/1');
    }

    const totalTeams = await LaLiga.getEquiposCount();
    const totalPages = Math.max(1, Math.ceil(totalTeams / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);

    if (requestedPage !== currentPage) {
        return res.redirect(`/index/${currentPage}`);
    }

    const offset = (currentPage - 1) * pageSize;
    const teams = await LaLiga.getEquipos(offset);
    const menuTeams = await LaLiga.equipos.find().toArray();

    const pages = [];

    for (let number = 1; number <= totalPages; number++) {
        pages.push({
            number,
            active: number === currentPage
        });
    }

    res.render('index', {
        equipos: teams,
        allEquipos: menuTeams,
        hayEquipos: totalTeams > 0,
        pages,
        hasPrevious: currentPage > 1,
        previousPage: currentPage - 1,
        hasNext: currentPage < totalPages,
        nextPage: currentPage + 1
    });
});

router.get('/formularioEquipo', (req, res) => {
    const positions = [];

    for (let number = 1; number <= 20; number++) {
        positions.push({ number, selected: false });
    }

    res.render('formularioEquipo', {
        positions,
        allEquipos,
        hayEquipos
    });
});

router.post('/guardarEquipo', upload.single('imagen'), async (req, res) => {
    const teamId = readText(req.body.id);
    let previousTeam = null;
    async function showError(message, status = 400) {
        if (req.file) {
            await fs.rm(req.file.path, { force: true });
        }

        return renderFormError(
            res,
            message,
            previousTeam
            ? `/equipo/${teamId}/editar`
            : '/formularioEquipo',
            status
        );
    }

    if (teamId) {
        if (!/^[a-f\d]{24}$/i.test(teamId)) {
            return showError('El identificador del equipo es incorrecto.');
        }

        previousTeam = await LaLiga.getEquipo(teamId);

        if (!previousTeam) {
            return showError('El equipo no existe.', 404);
        }
    }

    const teamName = readText(req.body.nombre);
    const city = readText(req.body.ciudad);
    const president = readText(req.body.presidente);
    const stadium = readText(req.body.estadio);
    const description = readText(req.body.biografia);
    const foundationDate = readText(req.body.fecha);
    const fact = readText(req.body.dato);

    const points = readOptionalNumber(req.body.puntos);
    const seasons = readOptionalNumber(req.body.temporadas);
    const leagueTitles = readOptionalNumber(req.body.ligas);
    const bestPosition = readOptionalNumber(
        req.body.mejorPosicion,
        null
    );

    if (!req.file && !previousTeam?.escudo) {
        return showError('Selecciona una imagen para el escudo.');
    }

    if (!teamName || !city || !president || !stadium || !foundationDate) {
        return showError(
            'Rellena el nombre, la ciudad, el presidente, el estadio y la fecha.'
        );
    }

    if (!/^\p{Lu}/u.test(teamName)) {
        return showError('El nombre del equipo debe empezar por mayúscula.');
    }

    const parsedDate = new Date(`${foundationDate}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);

    const validDate =
        /^\d{4}-\d{2}-\d{2}$/.test(foundationDate) &&
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === foundationDate &&
        foundationDate <= today;

    if (!validDate) {
        return showError(
            'Introduce una fecha de fundación válida que no sea futura.'
        );
    }

    if (description.length < 10 || description.length > 1000) {
        return showError('La biografía debe tener entre 10 y 1000 caracteres.');
    }

    if (!isIntegerInRange(points, 0, 150)) {
        return showError('Los puntos deben ser un número entero entre 0 y 150.');
    }

    if (!isIntegerInRange(seasons, 0, 200)) {
        return showError(
            'Las temporadas deben ser un número entero entre 0 y 200.'
        );
    }

    if (!isIntegerInRange(leagueTitles, 0, 200)) {
        return showError(
            'Las ligas ganadas deben ser un número entero entre 0 y 200.'
        );
    }

    if (
        bestPosition !== null &&
        !isIntegerInRange(bestPosition, 1, 20)
    ) {
        return showError('La mejor posición debe estar entre 1 y 20.');
    }

    const nameFilter = { nombre: teamName };

    if (previousTeam) {
        nameFilter._id = { $ne: previousTeam._id };
    }

    const existingTeam = await LaLiga.equipos.findOne(nameFilter);

    if (existingTeam) {
        return showError('Ya existe otro equipo con ese nombre.', 409);
    }

    const newTeam = {
        nombre: teamName,
        ciudad: city,
        fundacion: foundationDate,
        presidente: president,
        estadio: stadium,
        biografia: description,
        puntos: points,
        posicion: 0,
        temporadas: seasons,
        ligas: leagueTitles,
        mejorPosicion: bestPosition,
        dato: fact,
        escudo: req.file?.filename ?? previousTeam?.escudo,
    };

    let savedId;

    if (previousTeam) {
        const result = await LaLiga.equipos.updateOne(
            { _id: previousTeam._id },
            { $set: newTeam }
        );

        if (result.matchedCount === 0) {
            return showError('El equipo ya no existe.', 404);
        }

        savedId = previousTeam._id;
    } else {
        newTeam.jugadores = [];

        const result = await LaLiga.addequipo(newTeam);
        savedId = result.insertedId;
    }

    const teams = await LaLiga.equipos
        .find()
        .sort({ puntos: -1, _id: 1 })
        .toArray();

    for (let index = 0; index < teams.length; index++) {
        await LaLiga.equipos.updateOne(
            { _id: teams[index]._id },
            { $set: { posicion: index + 1 } }
        );
    }

    allEquipos = await LaLiga.equipos.find().toArray();
    hayEquipos = allEquipos.length > 0;

    return res.render('confirmacion', {
        message: previousTeam
            ? 'El equipo se ha actualizado correctamente.'
            : 'El equipo se ha creado correctamente.',
        returnUrl: `/equipo/${savedId}`,
        returnLabel: 'Ver equipo',
        allEquipos,
        hayEquipos
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
    let hayJugadores = equipo.jugadores.length !== 0;
    res.render('equipo', { equipo: equipo, allEquipos: allEquipos, hayEquipos: hayEquipos, hayJugadores: hayJugadores });
});

router.post('/nuevoJugador/:id', async (req, res) => {
    let jugador = {
        _id: new ObjectId(),
        nombre: req.body.nombre,
        nacionalidad: req.body.nacionalidad,
        edad: req.body.edad,
        posicion: req.body.posicion,
        partidos: req.body.partidos,
        goles: req.body.goles,
        asistencias: req.body.asistencias
    };
    await LaLiga.equipos.updateOne({ _id: new ObjectId(req.params.id) }, { $push: { jugadores: jugador } });
    res.render(`confirmacion`, {
        message: 'El jugador se ha añadido correctamente.',
        returnUrl: `/equipo/${req.params.id}`,
        returnLabel: 'Volver al equipo'
    });
});

router.post('/equipo/:id/borrar', async (req, res) => {
    const equipo = await LaLiga.deleteequipo(req.params.id);

    if (!equipo) {
        return res.status(404).render('error', {
            message: 'El equipo no existe.',
            returnUrl: '/index/1',
            returnLabel: 'Volver al listado'
        });
    }

    if (equipo.escudo) {
        await fs.rm(`${LaLiga.UPLOADS_FOLDER}/${equipo.escudo}`, {
            force: true
        });
    }

    allEquipos = await LaLiga.equipos.find().toArray();
    hayEquipos = allEquipos.length > 0;

    res.render('confirmacion', {
        message: 'El equipo se ha eliminado correctamente.',
        returnUrl: '/index/1',
        returnLabel: 'Volver al listado',
        allEquipos,
        hayEquipos
    });
});

router.get('/equipo/:id/editar', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return renderFormError(
            res,
            'El identificador del equipo es incorrecto.',
            '/index/1'
        );
    }

    const team = await LaLiga.getEquipo(req.params.id);

    if (!team) {
        return renderFormError(
            res,
            'El equipo no existe.',
            '/index/1',
            404
        );
    }

    const positions = [];

    for (let number = 1; number <= 20; number++) {
        positions.push({
            number,
            selected: number === Number(team.mejorPosicion)
        });
    }

    res.render('formularioEquipo', {
        equipo: team,
        editing: true,
        positions,
        allEquipos,
        hayEquipos
    });
});

router.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    console.error(error);

    const returnUrl = req.path.startsWith('/nuevoJugador/')
        ? '/index/1'
        : '/formularioEquipo';

    if (error instanceof multer.MulterError) {
        return renderFormError(
            res,
            'No se ha podido procesar el archivo. Revisa el campo del escudo.',
            returnUrl
        );
    }

    return renderFormError(
        res,
        'Ha ocurrido un error al procesar la petición. Comprueba los datos e inténtalo de nuevo.',
        returnUrl,
        500
    );
});

router.post('/borrarJugador/:equipoId/:jugadorId', async (req, res) => {
    const equipoId = req.params.equipoId;
    const jugadorId = req.params.jugadorId;
    await LaLiga.equipos.updateOne(
        { _id: new ObjectId(equipoId) },
        { $pull: { jugadores: { _id: new ObjectId(jugadorId) } } }
    );
    res.render('confirmacion', {
        message: 'El jugador se ha borrado correctamente.',
        returnUrl: `/equipo/${equipoId}`,
        returnLabel: 'Volver al equipo'
    });
});

router.post('/formEditarJugador/:equipoId/:jugadorId', async (req, res) => {
    const equipoId = req.params.equipoId;
    const jugadorId = req.params.jugadorId;
    
    let equipo = await LaLiga.getEquipo(equipoId);
    let jugador = equipo.jugadores.find(
        jugador => jugador._id.toString() === jugadorId
    );
    res.render('equipo', { equipo: equipo, allEquipos: allEquipos, hayEquipos: hayEquipos, hayJugadores: true, jugador: jugador, editar: true });
});

router.post('/editarJugador/:equipoId/:jugadorId', async (req, res) => {
    const equipoId = req.params.equipoId;
    const jugadorId = req.params.jugadorId;

    await LaLiga.equipos.updateOne(
        { _id: new ObjectId(equipoId), 'jugadores._id': new ObjectId(jugadorId) },
        {
            $set: {
                'jugadores.$.nombre': req.body.nombre,
                'jugadores.$.nacionalidad': req.body.nacionalidad,
                'jugadores.$.edad': req.body.edad,
                'jugadores.$.posicion': req.body.posicion,
                'jugadores.$.partidos': req.body.partidos,
                'jugadores.$.goles': req.body.goles,
                'jugadores.$.asistencias': req.body.asistencias
            }
        }
    );
    res.render('confirmacion', {
        message: 'El jugador se ha editado correctamente.',
        returnUrl: `/equipo/${equipoId}`,
        returnLabel: 'Volver al equipo'
    });
});