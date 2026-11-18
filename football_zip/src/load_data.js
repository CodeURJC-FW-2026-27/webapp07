import fs from 'node:fs/promises';
import * as league from './board.js';

const UPLOADS_FOLDER = './uploads';
const DATA_FOLDER = './data';

await fs.mkdir(UPLOADS_FOLDER, { recursive: true });

// Rubric 2, 30: seed teams and players only when the database is empty;
// copy example crests from data to uploads without resetting existing teams.
if (await league.getTeamCount() === 0) {
    const dataString = await fs.readFile(
        `${DATA_FOLDER}/data.json`,
        'utf8'
    );

    const demoTeams = JSON.parse(dataString);

    for (const demoTeam of demoTeams) {
        const players = demoTeam.players ?? [];
        const team = { ...demoTeam };
        delete team.players;

        await fs.copyFile(
            `${DATA_FOLDER}/${team.crestFilename}`,
            `${UPLOADS_FOLDER}/${team.crestFilename}`
        );

        const teamId = await league.saveTeam(team);

        for (const player of players) {
            await league.addPlayer(teamId.toString(), player);
        }
    }

    console.log('Demo data loaded');
}