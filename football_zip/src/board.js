import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';
import fs from 'node:fs/promises';

// Rubric 23-24: use English identifiers, document fields and collection names.
const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('LaLiga');
const teamCollection = db.collection('teams');

export const UPLOADS_FOLDER = './uploads';
export const upload = multer({ dest: UPLOADS_FOLDER });

export function isUploadError(error) {
    return error instanceof multer.MulterError;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove an uploaded crest when it is replaced, rejected or deleted.
async function removeImage(filename) {
    if (filename) {
        await fs.rm(`${UPLOADS_FOLDER}/${filename}`, { force: true });
    }
}

export async function discardUploadedImage(file) {
    if (file) {
        await removeImage(file.filename);
    }
}

export async function getAllTeams() {
    return teamCollection.find().toArray();
}

// Rubric 4, 6-7: search by name and exclude the current team during duplicate checks.
export async function findTeamByName(name, excludedId) {
    const filter = {
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    };

    if (excludedId) {
        filter._id = { $ne: new ObjectId(excludedId) };
    }

    return teamCollection.findOne(filter);
}

// Rubric 13, 19, 29: reuse persistence for creation and editing; replace old crests.
export async function saveTeam(team, id) {
    let savedId;

    if (id) {
        const previousTeam = await getTeam(id);

        if (!previousTeam) {
            return null;
        }

        const result = await teamCollection.updateOne(
            { _id: previousTeam._id },
            { $set: team }
        );

        if (result.matchedCount === 0) {
            return null;
        }

        if (previousTeam.crestFilename !== team.crestFilename) {
            await removeImage(previousTeam.crestFilename);
        }

        savedId = previousTeam._id;
    } else {
        team.players = [];
        const result = await teamCollection.insertOne(team);
        savedId = result.insertedId;
    }

    await updateTeamPositions();
    return savedId;
}

// Rubric 11: delete the team, remove its crest and update the ranking.
export async function deleteTeam(id) {
    const team = await teamCollection.findOneAndDelete({ _id: new ObjectId(id) });

    if (team) {
        await updateTeamPositions();
        await removeImage(team.crestFilename);
    }

    return team;
}

// Remove all teams and their uploaded crests when explicitly requested.
export async function deleteTeams() {
    const teams = await teamCollection.find({}, { projection: { crestFilename: 1 } }).toArray();
    const result = await teamCollection.deleteMany({});

    await Promise.all(
        teams
            .filter(team => typeof team.crestFilename === 'string')
            .map(team => removeImage(team.crestFilename))
    );

    return result;
}



// Rubric 3, 5: fetch a sorted page, optionally filtered by city.
export async function getTeams(offset, limit = 6, city) {
    const filter = city ? { city: city } : {};
    return teamCollection.find(filter).sort({ points: -1 }).skip(offset).limit(limit).toArray();
}

// Rubric 9-10: load the complete team using its MongoDB identifier.
export async function getTeam(id) {
    return teamCollection.findOne({ _id: new ObjectId(id) });
}

export async function getTeamCount(city) {
    const filter = city ? { city: city } : {};
    return teamCollection.countDocuments(filter);
}

// Rubric 5: provide the non-empty city categories used by the filter.
export async function getCities() {
    const cities = await teamCollection.distinct('city');
    return cities
        .filter(city => typeof city === 'string' && city.trim() !== '')
        .sort((a, b) => a.localeCompare(b, 'es'));
}

// Recalculate the ranking after saving or deleting a team.
async function updateTeamPositions() {
    const teams = await teamCollection.find().sort({ points: -1, _id: 1 }).toArray();

    for (let index = 0; index < teams.length; index++) {
        await teamCollection.updateOne(
            { _id: teams[index]._id },
            { $set: { position: index + 1 } }
        );
    }
}

// Rubric 15: append a player to its team with a unique identifier.
export async function addPlayer(teamId, player) {
    player._id = new ObjectId();
    return teamCollection.updateOne(
        { _id: new ObjectId(teamId) },
        { $push: { players: player } }
    );
}

// Rubric 16: remove the selected player from its team.
export async function deletePlayer(teamId, playerId) {
    return teamCollection.updateOne(
        { _id: new ObjectId(teamId) },
        { $pull: { players: { _id: new ObjectId(playerId) } } }
    );
}

// Rubric 18: update only the fields of the selected embedded player.
export async function updatePlayer(teamId, playerId, player) {
    const fields = {};

    for (const [key, value] of Object.entries(player)) {
        fields[`players.$.${key}`] = value;
    }

    return teamCollection.updateOne(
        {
            _id: new ObjectId(teamId),
            'players._id': new ObjectId(playerId)
        },
        { $set: fields }
    );
}
