# Configuración en Hostinger VPS

## 1. Crear carpeta para fotos (una sola vez)

Conéctate por SSH a tu VPS Hostinger:

```bash
ssh usuario@tu-ip-vps
```

Crea la carpeta persistente:

```bash
# Opción A: En la carpeta pública (si es aplicación web)
mkdir -p /home/USERNAME/public_html/uploads/fotos
chmod -R 755 /home/USERNAME/public_html/uploads

# Opción B: En carpeta privada (más segura)
mkdir -p /home/USERNAME/datos/uploads/fotos
chmod -R 755 /home/USERNAME/datos/uploads
```

## 2. Actualizar `.env` en Hostinger

En tu `.env` en el VPS, agrega o descomenta:

**Opción A** (si la carpeta está en public_html):
```bash
UPLOADS_PATH=/home/USERNAME/public_html/uploads
```

**Opción B** (carpeta privada):
```bash
UPLOADS_PATH=/home/USERNAME/datos/uploads
```

## 3. Verificar permisos

El usuario que corre Node debe tener permisos de lectura/escritura:

```bash
# Ver qué usuario corre Node
ps aux | grep node

# Dar permisos (si corre como www-data)
sudo chown -R www-data:www-data /home/USERNAME/uploads
sudo chmod -R 755 /home/USERNAME/uploads
```

## 4. Acceder a las fotos

Una vez subidas, estarán disponibles en:

- Local: `http://localhost:3000/uploads/fotos/alumno_CODIGO.jpg`
- Hostinger: `https://tudominio.com/uploads/fotos/alumno_CODIGO.jpg`

## 5. Backup regular

Las fotos se guardan fuera del repo, así que **hazte backups**:

```bash
# En tu máquina local
scp -r usuario@tu-ip:/home/USERNAME/uploads /backups/cec-fotos
```

---

**En desarrollo local:** No necesitas hacer nada, todo funciona con `src/uploads/fotos/`
