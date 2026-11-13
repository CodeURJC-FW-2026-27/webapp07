import express from "express";
import mustacheExpress from "mustache-express";
import router from "./router.js";

const app = express();

app.engine('html', mustacheExpress());
app.set('view engine', 'html');

app.use('/public', express.static('public'));

app.use('/', router);
app.use(express.urlencoded({ extended: true }));

app.listen(3000, () => {
    console.log('Servidor escuchando en http://localhost:3000');
});