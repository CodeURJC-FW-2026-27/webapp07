import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';
import fs from 'node:fs/promises';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('LaLiga');
const equipos = db.collection('equipos');

export const UPLOADS_FOLDER = './uploads';
export const upload = multer({ dest: UPLOADS_FOLDER });

export function isUploadError(error) {
    return error instanceof multer.MulterError;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

export async function getAllEquipos() {
    return equipos.find().toArray();
}

export async function findEquipoByName(name, excludedId) {
    const filter = {
        nombre: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    };

    if (excludedId) {
        filter._id = { $ne: new ObjectId(excludedId) };
    }

    return equipos.findOne(filter);
}

export async function saveEquipo(equipo, id) {
    let savedId;

    if (id) {
        const previousTeam = await getEquipo(id);

        if (!previousTeam) {
            return null;
        }

        const result = await equipos.updateOne(
            { _id: previousTeam._id },
            { $set: equipo }
        );

        if (result.matchedCount === 0) {
            return null;
        }

        if (previousTeam.escudo !== equipo.escudo) {
            await removeImage(previousTeam.escudo);
        }

        savedId = previousTeam._id;
    } else {
        equipo.jugadores = [];
        const result = await equipos.insertOne(equipo);
        savedId = result.insertedId;
    }

    await updateTeamPositions();
    return savedId;
}

export async function deleteEquipo(id) {
    const equipo = await equipos.findOneAndDelete({ _id: new ObjectId(id) });

    if (equipo) {
        await removeImage(equipo.escudo);
    }

    return equipo;
}

export async function deleteEquipos() {
    const teams = await equipos.find({}, { projection: { escudo: 1 } }).toArray();
    const result = await equipos.deleteMany({});

    await Promise.all(
        teams
            .filter(team => typeof team.escudo === 'string')
            .map(team => removeImage(team.escudo))
    );

    return result;
}



export async function getEquipos(offset, limit = 6, ciudad) {
    const filter = ciudad ? { ciudad } : {};
    return equipos.find(filter).sort({ puntos: -1 }).skip(offset).limit(limit).toArray();
}

export async function getEquipo(id) {
    return equipos.findOne({ _id: new ObjectId(id) });
}

export async function getEquiposCount(ciudad) {
    const filter = ciudad ? { ciudad } : {};
    return equipos.countDocuments(filter);
}

export async function getCiudades() {
    const ciudades = await equipos.distinct('ciudad');
    return ciudades
        .filter(ciudad => typeof ciudad === 'string' && ciudad.trim() !== '')
        .sort((a, b) => a.localeCompare(b, 'es'));
}

async function updateTeamPositions() {
    const teams = await equipos.find().sort({ puntos: -1, _id: 1 }).toArray();

    for (let index = 0; index < teams.length; index++) {
        await equipos.updateOne(
            { _id: teams[index]._id },
            { $set: { posicion: index + 1 } }
        );
    }
}

export async function addJugador(teamId, jugador) {
    jugador._id = new ObjectId();
    return equipos.updateOne(
        { _id: new ObjectId(teamId) },
        { $push: { jugadores: jugador } }
    );
}

export async function deleteJugador(teamId, jugadorId) {
    return equipos.updateOne(
        { _id: new ObjectId(teamId) },
        { $pull: { jugadores: { _id: new ObjectId(jugadorId) } } }
    );
}

export async function updateJugador(teamId, jugadorId, jugador) {
    const fields = {};

    for (const [key, value] of Object.entries(jugador)) {
        fields[`jugadores.$.${key}`] = value;
    }

    return equipos.updateOne(
        {
            _id: new ObjectId(teamId),
            'jugadores._id': new ObjectId(jugadorId)
        },
        { $set: fields }
    );
}
