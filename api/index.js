const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum diatur di Environment Variables!');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
}

const kisiKisiSchema = new mongoose.Schema({
  kategori: { type: String, default: 'Umum' },
  pertanyaan: { type: String, required: true },
  opsiA: String,
  opsiB: String,
  opsiC: String,
  opsiD: String,
  jawaban: { type: String, required: true },
  pembahasan: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const KisiKisi = mongoose.models.KisiKisi || mongoose.model('KisiKisi', kisiKisiSchema);

app.get('/api/status', async (req, res) => {
  try {
    await connectDB();
    const total = await KisiKisi.countDocuments();
    res.json({ status: 'ok', database: 'kindly_learning', totalSoal: total });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/soal', async (req, res) => {
  try {
    await connectDB();
    const { kategori, search } = req.query;
    let query = {};
    if (kategori && kategori !== 'SEMUA') {
      query.kategori = kategori;
    }
    if (search) {
      query.$or = [
        { pertanyaan: { $regex: search, $options: 'i' } },
        { pembahasan: { $regex: search, $options: 'i' } },
        { kategori: { $regex: search, $options: 'i' } }
      ];
    }
    const data = await KisiKisi.find(query).sort({ createdAt: -1 });
    const categories = await KisiKisi.distinct('kategori');
    res.json({ soal: data, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    await connectDB();
    if (!req.file) {
      return res.status(400).json({ error: 'Pilih file Excel (.xlsx / .xls) terlebih dahulu!' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'File Excel kosong atau format kolom tidak terbaca.' });
    }

    const formattedData = rows.map(row => {
      const getVal = (keys) => {
        for (let k of Object.keys(row)) {
          if (keys.includes(k.trim().toLowerCase())) return String(row[k]).trim();
        }
        return '';
      };

      return {
        kategori: getVal(['kategori', 'materi', 'modul', 'topik']) || 'Umum',
        pertanyaan: getVal(['pertanyaan', 'soal', 'kisi-kisi', 'kisi_kisi', 'question']),
        opsiA: getVal(['a', 'opsi a', 'opsia', 'pilihan a']),
        opsiB: getVal(['b', 'opsi b', 'opsib', 'pilihan b']),
        opsiC: getVal(['c', 'opsi c', 'opsic', 'pilihan c']),
        opsiD: getVal(['d', 'opsi d', 'opsid', 'pilihan d']),
        jawaban: getVal(['jawaban', 'kunci', 'kunci jawaban', 'answer']),
        pembahasan: getVal(['pembahasan', 'keterangan', 'penjelasan', 'catatan'])
      };
    }).filter(item => item.pertanyaan && item.jawaban);

    if (formattedData.length === 0) {
      return res.status(400).json({ 
        error: 'Format kolom tidak sesuai. Pastikan minimal ada kolom "Pertanyaan" dan "Jawaban".' 
      });
    }

    if (req.body.replace === 'true') {
      await KisiKisi.deleteMany({});
    }

    await KisiKisi.insertMany(formattedData);
    res.json({ 
      message: `Berhasil menyimpan ${formattedData.length} kisi-kisi ke MongoDB Atlas!`,
      insertedCount: formattedData.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/soal/:id', async (req, res) => {
  try {
    await connectDB();
    await KisiKisi.findByIdAndDelete(req.params.id);
    res.json({ message: 'Soal dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/soal', async (req, res) => {
  try {
    await connectDB();
    await KisiKisi.deleteMany({});
    res.json({ message: 'Semua data berhasil dikosongkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
