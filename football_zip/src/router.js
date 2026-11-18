import express from 'express';

import * as league from './board.js';

const router = express.Router();
export default router;

// Load the team links shared by the navigation menu.
async function getMenuData() {
    const allTeams = await league.getAllTeams();
    return {
        allTeams,
        hasTeams: allTeams.length > 0
    };
}

// Preserve the existing public query parameter names and the original page.
function getFilteredUrl(city, page, originPage) {
    const params = new URLSearchParams({
        ciudad: city,
        pagina: String(page),
        paginaOrigen: String(originPage)
    });
    return `/filtrar?${params}`;
}

// Rubric 3, 5, 9: show six teams per page, city filters and detail links.
async function renderIndex(res, city, requestedPage, originPage) {
    const pageSize = 6;
    const totalTeams = await league.getTeamCount(city);
    const totalPages = Math.max(1, Math.ceil(totalTeams / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);

    if (requestedPage !== currentPage) {
        return res.redirect(
            city
                ? getFilteredUrl(city, currentPage, originPage)
                : `/index/${currentPage}`
        );
    }

    const offset = (currentPage - 1) * pageSize;
    const teams = await league.getTeams(offset, pageSize, city);
    const [menuTeams, cities] = await Promise.all([
        league.getAllTeams(),
        league.getCities()
    ]);
    const pages = [];

    for (let number = 1; number <= totalPages; number++) {
        pages.push({
            number,
            active: number === currentPage,
            url: city
                ? getFilteredUrl(city, number, originPage)
                : `/index/${number}`
        });
    }

    res.render('index', {
        teams: teams,
        allTeams: menuTeams,
        hasTeams: totalTeams > 0,
        pages,
        hasPrevious: currentPage > 1,
        previousPage: currentPage - 1,
        previousUrl: city
            ? getFilteredUrl(city, currentPage - 1, originPage)
            : `/index/${currentPage - 1}`,
        hasNext: currentPage < totalPages,
        nextPage: currentPage + 1,
        nextUrl: city
            ? getFilteredUrl(city, currentPage + 1, originPage)
            : `/index/${currentPage + 1}`,
        cities: cities.map(value => ({
            value,
            selected: value === city
        })),
        allCitiesSelected: !city,
        filterActive: Boolean(city),
        selectedCity: city || '',
        originPage,
        emptyTeamsMessage: city
            ? `No hay equipos registrados en ${city}.`
            : 'No hay equipos registrados.'
    });
}

// Normalize form values before server-side validation.
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

// Rubric 7, 15, 18, 25, 29: share player parsing and validation for creation/editing.
function parsePlayerForm(body = {}) {
    const player = {
        nombre: readText(body.name),
        nacionalidad: readText(body.nationality),
        edad: Number(readText(body.age)),
        posicion: readText(body.position),
        partidos: readOptionalNumber(body.matches),
        goles: readOptionalNumber(body.goals),
        asistencias: readOptionalNumber(body.assists)
    };

    if (!player.nombre || !player.nacionalidad) {
        return { error: 'Rellena el nombre y la nacionalidad del jugador.' };
    }
    if (!isIntegerInRange(player.edad, 1, 120)) {
        return { error: 'La edad debe ser un número entero entre 1 y 120.' };
    }
    const positions = ['portero', 'defensa', 'centrocampista', 'delantero'];
    if (!positions.includes(player.posicion)) {
        return { error: 'Selecciona una posición válida para el jugador.' };
    }
    if (![player.partidos, player.goles, player.asistencias].every(
        value => isIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER)
    )) {
        return { error: 'Los partidos, goles y asistencias deben ser números enteros no negativos.' };
    }

    return { player };
}

// Rubric 8, 28: render the shared error view with a return link.
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

// Rubric 4: find a team by name and open its detail page.
router.get('/buscar', async (req, res) => {
    const searchTerm = (req.query.busqueda ?? '').trim();

    if (!searchTerm) {
        return res.redirect('/index/1');
    }

    const team = await league.findTeamByName(searchTerm);

    if (team) {
        return res.redirect(`/equipo/${team._id}`);
    }

    return res.status(404).render('error', {
        message: `No se encontró el equipo "${searchTerm}".`,
        returnUrl: '/index/1',
        returnLabel: 'Volver al inicio'
    });
});


router.get('/index/:page', async (req, res) => {
    const requestedPage = Number(req.params.page);

    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
        return res.redirect('/index/1');
    }

    return renderIndex(res, null, requestedPage, requestedPage);
});

// Rubric 5: apply the selected city while preserving pagination.
router.get('/filtrar', async (req, res) => {
    const city = readText(req.query.ciudad);
    const requestedPage = Number(req.query.pagina ?? 1);
    const requestedOriginPage = Number(req.query.paginaOrigen ?? 1);
    const originPage =
        Number.isSafeInteger(requestedOriginPage) && requestedOriginPage > 0
            ? requestedOriginPage
            : 1;

    if (!city) {
        return res.redirect(`/index/${originPage}`);
    }

    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
        return res.redirect(getFilteredUrl(city, 1, originPage));
    }

    return renderIndex(res, city, requestedPage, originPage);
});
// Rubric 6, 29: open the shared team form for a new team.
router.get('/formularioEquipo', async (req, res) => {
    const positions = [];
    const menuData = await getMenuData();

    for (let number = 1; number <= 20; number++) {
        positions.push({ number, selected: false });
    }

    res.render('formularioEquipo', {
        positions,
        ...menuData
    });
});

// Rubric 6-7, 13, 19, 20, 27, 29: validate, save and confirm team creation/editing.
router.post('/guardarEquipo', league.upload.single('image'), async (req, res) => {
    const teamId = readText(req.body.id);
    let previousTeam = null;
    async function showError(message, status = 400) {
        if (req.file) {
            await league.discardUploadedImage(req.file);
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

        previousTeam = await league.getTeam(teamId);

        if (!previousTeam) {
            return showError('El equipo no existe.', 404);
        }
    }

    const teamName = readText(req.body.name);
    const city = readText(req.body.city);
    const president = readText(req.body.president);
    const stadium = readText(req.body.stadium);
    const description = readText(req.body.description);
    const foundationDate = readText(req.body.foundationDate);
    const fact = readText(req.body.fact);

    const points = readOptionalNumber(req.body.points);
    const seasons = readOptionalNumber(req.body.seasons);
    const leagueTitles = readOptionalNumber(req.body.leagueTitles);
    const bestPosition = readOptionalNumber(
        req.body.bestPosition,
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

    const existingTeam = await league.findTeamByName(teamName, teamId);

    if (existingTeam) {
        return showError('Ya existe otro equipo con ese nombre.', 409);
    }

    // Keep the existing database field names so previously saved teams still work.
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

    const savedId = await league.saveTeam(newTeam, teamId || undefined);

    if (!savedId) {
        return showError('El equipo ya no existe.', 404);
    }

    const menuData = await getMenuData();

    return res.render('confirmacion', {
        message: previousTeam
            ? 'El equipo se ha actualizado correctamente.'
            : 'El equipo se ha creado correctamente.',
        returnUrl: `/equipo/${savedId}`,
        returnLabel: 'Ver equipo',
        ...menuData
    });
});
// Rubric 10: send the crest associated with the requested team.
router.get('/equipo/:id/imagen', async (req, res) => {
    const team = await league.getTeam(req.params.id);

    if (!team || !team.escudo) {
        return res.status(404).send('Imagen no encontrada');
    }

    res.sendFile(team.escudo, {
        root: league.UPLOADS_FOLDER
    });
});    

// Rubric 9-10, 14: load the team detail and its related players.
router.get('/equipo/:id', async (req, res) => {
    const team = await league.getTeam(req.params.id);
    if (!team) {
        return res.status(404).send('Equipo no encontrado');
    }
    const hasPlayers = team.jugadores.length !== 0;
    const menuData = await getMenuData();
    res.render('equipo', {
        team,
        ...menuData,
        hasPlayers
    });
});

// Rubric 15, 29: reuse the same player-saving handler.
router.post('/nuevoJugador/:id', savePlayer);

// Rubric 11, 20: delete the team and show the shared confirmation.
router.post('/equipo/:id/borrar', async (req, res) => {
    const team = await league.deleteTeam(req.params.id);

    if (!team) {
        return res.status(404).render('error', {
            message: 'El equipo no existe.',
            returnUrl: '/index/1',
            returnLabel: 'Volver al listado'
        });
    }

    const menuData = await getMenuData();

    res.render('confirmacion', {
        message: 'El equipo se ha eliminado correctamente.',
        returnUrl: '/index/1',
        returnLabel: 'Volver al listado',
        ...menuData
    });
});

// Rubric 12, 29: prefill the shared team form and select its current best position.
router.get('/equipo/:id/editar', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return renderFormError(
            res,
            'El identificador del equipo es incorrecto.',
            '/index/1'
        );
    }

    const team = await league.getTeam(req.params.id);

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

    const menuData = await getMenuData();
    res.render('formularioEquipo', {
        team: team,
        editing: true,
        positions,
        ...menuData
    });
});

// Rubric 8, 28: use the shared error page for upload and request errors.
router.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    console.error(error);

    const returnUrl = req.path.startsWith('/nuevoJugador/')
        ? '/index/1'
        : '/formularioEquipo';

    if (league.isUploadError(error)) {
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

// Rubric 16, 20: delete a player and display confirmation.
router.post('/borrarJugador/:teamId/:playerId', async (req, res) => {
    const teamId = req.params.teamId;
    const playerId = req.params.playerId;
    await league.deletePlayer(teamId, playerId);
    res.render('confirmacion', {
        message: 'El jugador se ha borrado correctamente.',
        returnUrl: `/equipo/${teamId}`,
        returnLabel: 'Volver al equipo'
    });
});

// Rubric 17, 29: prefill the existing player form within the team detail.
router.post('/formEditarJugador/:teamId/:playerId', async (req, res) => {
    const teamId = req.params.teamId;
    const playerId = req.params.playerId;
    
    const team = await league.getTeam(teamId);
    const player = team.jugadores.find(
        player => player._id.toString() === playerId
    );
    const menuData = await getMenuData();
    res.render('equipo', {
        isGoalkeeper: player.posicion === 'portero',
        isDefender: player.posicion === 'defensa',
        isMidfielder: player.posicion === 'centrocampista',
        isForward: player.posicion === 'delantero',
        team,
        ...menuData,
        hasPlayers: true,
        player,
        editingPlayer: true
    });
});

// Rubric 7, 15, 18, 20, 25, 27, 29: validate and save new/edited players.
async function savePlayer(req, res) {
    const teamId = req.params.teamId || req.params.id;
    const playerId = req.params.playerId;
    const returnUrl = '/equipo/' + teamId;

    if (!/^[a-f\d]{24}$/i.test(teamId) ||
        (playerId && !/^[a-f\d]{24}$/i.test(playerId))) {
        return renderFormError(res, 'El identificador del equipo o jugador es incorrecto.', '/index/1');
    }

    const { player, error } = parsePlayerForm(req.body);
    if (error) {
        return renderFormError(res, error, returnUrl);
    }

    const result = playerId
        ? await league.updatePlayer(teamId, playerId, player)
        : await league.addPlayer(teamId, player);

    if (result.matchedCount === 0) {
        return renderFormError(res, 'El equipo o jugador ya no existe.', '/index/1', 404);
    }

    return res.render('confirmacion', {
        message: playerId
            ? 'El jugador se ha editado correctamente.'
            : 'El jugador se ha añadido correctamente.',
        returnUrl,
        returnLabel: 'Volver al equipo'
    });
}

router.post(['/guardarJugador/:teamId/:playerId', '/guardarJugador/:teamId/'], savePlayer);
