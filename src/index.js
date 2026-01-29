const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Backend MVC funcionando desde la carpeta /src');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));