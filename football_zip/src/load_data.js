import fs from 'node:fs/promises';
import * as LaLiga from './board.js';

const UPLOADS_FOLDER = './uploads';
const DATA_FOLDER = './data';

await fs.mkdir(UPLOADS_FOLDER, { recursive: true });

if (await LaLiga.getEquiposCount() === 0) {
    const dataString = await fs.readFile(
        `${DATA_FOLDER}/data.json`,
        'utf8'
    );

    const demoTeams = JSON.parse(dataString);

    for (const demoTeam of demoTeams) {
        const players = demoTeam.jugadores ?? [];
        const team = { ...demoTeam };
        delete team.jugadores;

        await fs.copyFile(
            `${DATA_FOLDER}/${team.escudo}`,
            `${UPLOADS_FOLDER}/${team.escudo}`
        );

        const teamId = await LaLiga.saveEquipo(team);

        for (const player of players) {
            await LaLiga.addJugador(teamId.toString(), player);
        }
    }

    console.log('Demo data loaded');
}