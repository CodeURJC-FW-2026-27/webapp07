import fs from 'node:fs/promises';
import * as LaLiga from './board.js';

const UPLOADS_FOLDER = './uploads';
const DATA_FOLDER = './data';

let dataFile = 'data.json';

const dataString = await fs.readFile(DATA_FOLDER + '/' + dataFile, 'utf8');

const origin_equipos = JSON.parse(dataString);

await LaLiga.deleteEquipos();

await fs.rm(UPLOADS_FOLDER, { recursive: true, force: true });
await fs.mkdir(UPLOADS_FOLDER);

for (const originEquipo of origin_equipos) {
    const jugadores = originEquipo.jugadores ?? [];
    const equipo = { ...originEquipo };
    delete equipo.jugadores;

    await fs.copyFile(
        `${DATA_FOLDER}/${equipo.escudo}`,
        `${UPLOADS_FOLDER}/${equipo.escudo}`
    );

    const teamId = await LaLiga.saveEquipo(equipo);

    for (const jugador of jugadores) {
        await LaLiga.addJugador(teamId.toString(), jugador);
    }
}

console.log('Demo data loaded');