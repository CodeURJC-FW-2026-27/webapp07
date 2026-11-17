import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const router = express.Router();
export default router;

const client = new MongoClient('mongodb://localhost:27017');

const db = client.db('LaLiga');
export const equipos = db.collection('equipos');

export const UPLOADS_FOLDER = './uploads';

export async function addequipo(equipo) {

    return await equipos.insertOne(equipo);
}

export async function deleteequipo(id){

    return await equipos.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deleteEquipos(){

    return await equipos.deleteMany();
}

export async function getEquipos(salto){

    return await equipos.find().sort({ puntos: -1 }).skip(salto).limit(6).toArray();
}

export async function getEquipo(id){

    return await equipos.findOne({ _id: new ObjectId(id) });
}
export async function getEquiposCount(){

    return await equipos.countDocuments();
}



export async function addejugador(jugador) {

    return await jugadores.insertOne(jugador);
}

export async function deletejugador(id){

    return await jugadores.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deleteJugadores(){

    return await jugadores.deleteMany();
}

export async function getJugadores(){

    return await jugadores.find().toArray();
}

export async function getJugador(id){

    return await jugadores.findOne({ _id: new ObjectId(id) });
}