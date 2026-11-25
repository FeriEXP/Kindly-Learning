const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getDb() {
  if (!uri) throw new Error('MONGODB_URI belum disetel di Vercel');
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  return cachedClient.db('kindly_learning');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getDb();
    const col = db.collection('questions');

    // GET: Ambil semua data atau cari berdasarkan kata kunci soal
    if (req.method === 'GET') {
      const q = (req.query.q || '').trim();
      const modul = (req.query.modul || '').trim();

      let filter = {};
      if (q) {
        filter.$or = [
          { soal: { $regex: q, $options: 'i' } },
          { jawaban: { $regex: q, $options: 'i' } }
        ];
      }
      if (modul && modul !== 'ALL') {
        filter.modul = modul;
      }

      const items = await col.find(filter).sort({ _id: -1 }).limit(1000).toArray();
      return res.status(200).json({ ok: true, count: items.length, data: items });
    }

    // POST: Tambah soal satuan atau massal (Excel/CSV)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (Array.isArray(body.items)) {
        const docs = body.items
          .filter(x => x.soal && x.jawaban)
          .map(x => ({
            modul: String(x.modul || 'Umum').trim(),
            soal: String(x.soal).trim(),
            jawaban: String(x.jawaban).trim(),
            createdAt: new Date()
          }));
        if (docs.length === 0) return res.status(400).json({ ok: false, error: 'Data kosong' });
        const result = await col.insertMany(docs);
        return res.status(200).json({ ok: true, inserted: result.insertedCount });
      }

      if (body.soal && body.jawaban) {
        const doc = {
          modul: String(body.modul || 'Umum').trim(),
          soal: String(body.soal).trim(),
          jawaban: String(body.jawaban).trim(),
          createdAt: new Date()
        };
        const result = await col.insertOne(doc);
        return res.status(200).json({ ok: true, id: result.insertedId });
      }

      return res.status(400).json({ ok: false, error: 'Format data tidak valid' });
    }

    // DELETE: Hapus satu item atau reset semua
    if (req.method === 'DELETE') {
      if (req.query.all === '1') {
        await col.deleteMany({});
        return res.status(200).json({ ok: true, message: 'Semua data dihapus' });
      }
      if (req.query.id) {
        await col.deleteOne({ _id: new ObjectId(req.query.id) });
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(405).json({ ok: false, error: 'Method tidak didukung' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
