const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(express.json());

/* ══════════════════════════════════════════
   VERİ YAPILARI
══════════════════════════════════════════ */

// socketId -> { id, kullaniciadi, cinsiyet, fbid, opucuk, seviye, yetki, salon, sandalye }
const users = new Map();

// salonId -> { id, ad, salonid, sandalye1..12 data, spin:{queue,idx,timer} }
const salonlar = new Map();

// chat tarixi: salonId -> son 50 mesaj
const chatHistory = new Map();

// aktif müzik: salonId -> { link, fbid, kullaniciadi }
const aktifSarki = new Map();

/* ══ YARDIMCI FONKSİYONLAR ══ */

function getSalon(salonId) {
  if (!salonlar.has(salonId)) {
    salonlar.set(salonId, {
      id: salonId,
      ad: 'Salon ' + salonId,
      salonid: ((parseInt(salonId) - 1) % 5) + 1,
      online: 0,
      spin: { queue: [], idx: 0, timer: null, autoTimer: null },
    });
    // 12 sandalye başlangıç değerleri
    for (let i = 1; i <= 12; i++) {
      const s = salonlar.get(salonId);
      s['sandalye' + i]            = 0;
      s['sandalye' + i + 'ad']     = '';
      s['sandalye' + i + 'fb']     = '';
      s['sandalye' + i + 'muck']   = 0;
      s['sandalye' + i + 'tip']    = '';
      s['sandalye' + i + 'cinsiyet'] = 'male';
      s['sandalye' + i + 'hediye'] = 0;
      s['sandalye' + i + 'sapkahediye'] = 0;
    }
  }
  return salonlar.get(salonId);
}

function bosKoltukBul(salon) {
  for (let i = 1; i <= 12; i++) {
    if (!salon['sandalye' + i]) return i;
  }
  return null;
}

function salonOzeti(salonId) {
  const s = getSalon(salonId);
  const sids = [...users.values()].filter(u => u.salon == salonId);
  return { ...s, online: sids.length };
}

function herkeseSalonListesi() {
  const liste = [];
  salonlar.forEach((s, id) => {
    const sids = [...users.values()].filter(u => u.salon == id);
    liste.push({ id, ad: s.ad, salonid: s.salonid, online: sids.length });
  });
  // Boş salonları da göster (1-5)
  for (let i = 1; i <= 5; i++) {
    if (!liste.find(x => x.id == i)) {
      liste.push({ id: i, ad: 'Salon ' + i, salonid: i, online: 0 });
    }
  }
  io.emit('salonlar', liste.sort((a,b) => a.id - b.id));
  // Her salonun online sayısını güncelle
  liste.forEach(s => io.emit('up', s.online, s.id));
}

/* ══ SPIN SIRA SİSTEMİ ══ */

function spinSiraSonraki(salonId) {
  const salon = getSalon(salonId);
  const spin  = salon.spin;
  clearTimeout(spin.autoTimer);
  if (!spin.queue.length) return;

  spin.idx = (spin.idx + 1) % spin.queue.length;
  const siradaki = spin.queue[spin.idx];

  io.to('salon_' + salonId).emit('sira', siradaki);
  console.log('[sira] salon=' + salonId + ' koltuk=' + siradaki);

  // 8 saniyə keçsə avtomatik çevir
  spin.autoTimer = setTimeout(() => {
    const s2 = getSalon(salonId);
    if (s2.spin.queue[s2.spin.idx] !== siradaki) return;
    // Şişəni avtomatik çevir
    const hedef = avtomatikSise(salonId, siradaki);
    if (hedef) {
      io.to('salon_' + salonId).emit('cevir', siradaki, hedef);
      setTimeout(() => {
        io.to('salon_' + salonId).emit('ortayaGetir', siradaki, hedef);
        setTimeout(() => {
          io.to('salon_' + salonId).emit('geriDon');
          setTimeout(() => spinSiraSonraki(salonId), 8000);
        }, 8000);
      }, 6000);
    }
  }, 8000);
}

function avtomatikSise(salonId, spinner) {
  const salon = getSalon(salonId);
  // Spinner olmayan, dolu koltuklar
  const diger = [];
  for (let i = 1; i <= 12; i++) {
    if (salon['sandalye' + i] && i !== spinner) diger.push(i);
  }
  if (!diger.length) return null;
  return diger[Math.floor(Math.random() * diger.length)];
}

/* ══════════════════════════════════════════
   SOCKET.IO BAĞLANTILAR
══════════════════════════════════════════ */

io.on('connection', (socket) => {
  console.log('Bağlandı:', socket.id);

  /* ── Giriş ── */
  socket.on('giris', (userData) => {
    // userData: { id, kullaniciadi, cinsiyet, fbid, opucuk, seviye, yetki }
    // ya da sadece string id (köhnə sistem)
    let user;
    if (typeof userData === 'object') {
      user = { ...userData, salon: null, sandalye: null };
    } else {
      // Köhnə sistem: sadece id string
      user = {
        id:           userData,
        kullaniciadi: 'Oyuncu',
        cinsiyet:     'male',
        fbid:         userData,
        opucuk:       0,
        seviye:       1,
        yetki:        0,
        salon:        null,
        sandalye:     null,
      };
    }
    users.set(socket.id, user);

    socket.emit('hi', {
      id:     user.id,
      opucuk: user.opucuk,
      seviye: user.seviye,
      yetki:  user.yetki,
    });

    // Salon listesi gönder
    herkeseSalonListesi();
    socket.emit('salonlar', (() => {
      const liste = [];
      for (let i = 1; i <= 5; i++) {
        const s = getSalon(i);
        const cnt = [...users.values()].filter(u => u.salon == i).length;
        liste.push({ id: i, ad: s.ad, salonid: s.salonid, online: cnt });
      }
      return liste;
    })());

    console.log('[giris]', user.kullaniciadi, user.id);
  });

  /* ── Salona gir ── */
  socket.on('salonON', (salonId) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Əvvəlki salonu tərk et
    if (user.salon) _salonTerk(socket, user);

    const salon = getSalon(salonId);
    const koltuk = bosKoltukBul(salon);
    if (!koltuk) {
      socket.emit('engel', 'Salon dolu!');
      return;
    }

    // Salona qoşul
    socket.join('salon_' + salonId);
    user.salon    = salonId;
    user.sandalye = koltuk;

    // Koltukya oturt
    salon['sandalye' + koltuk]            = koltuk;
    salon['sandalye' + koltuk + 'ad']     = user.kullaniciadi;
    salon['sandalye' + koltuk + 'fb']     = user.fbid || user.id;
    salon['sandalye' + koltuk + 'muck']   = user.opucuk;
    salon['sandalye' + koltuk + 'tip']    = user.seviye;
    salon['sandalye' + koltuk + 'cinsiyet'] = user.cinsiyet;
    salon['sandalye' + koltuk + 'hediye'] = 0;
    salon['sandalye' + koltuk + 'sapkahediye'] = 0;

    // Spin növbəsinə əlavə et
    if (!salon.spin.queue.includes(koltuk)) {
      salon.spin.queue.push(koltuk);
    }

    // Giriş bildirimi
    const salonData = { ...salon };
    socket.emit('salongiris', salonData, koltuk);
    socket.to('salon_' + salonId).emit('gelenvar', salonData, koltuk);

    // Chat tarixini göndər
    const hist = chatHistory.get(salonId) || [];
    hist.forEach(m => socket.emit('mesaj', m.user, m.text, m.hedef));

    // Aktif musiqi varsa göndər
    const sarki = aktifSarki.get(salonId);
    if (sarki) socket.emit('sarkivar', sarki.link, sarki.fbid, sarki.kullaniciadi);

    // Sıra bildirimi — qoşulana mevcut sırayı göndər
    if (salon.spin.queue.length > 0) {
      const siraki = salon.spin.queue[salon.spin.idx];
      socket.emit('sira', siraki);
    }

    // İlk oyuncu ise sırayı başlat
    if (salon.spin.queue.length === 1) {
      io.to('salon_' + salonId).emit('sira', koltuk);
    }

    herkeseSalonListesi();
    console.log('[salonON]', user.kullaniciadi, '-> salon', salonId, 'koltuk', koltuk);
  });

  /* ── Salonu tərk et ── */
  socket.on('salonOFF', () => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    _salonTerk(socket, user);
    herkeseSalonListesi();
  });

  /* ── Şişə çevir (istəyib serverə bildirir) ── */
  socket.on('sise', () => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    const salon   = getSalon(user.salon);
    const siraKoltuk = salon.spin.queue[salon.spin.idx];

    // Sırası gəlmişmi?
    if (siraKoltuk !== user.sandalye) return;

    clearTimeout(salon.spin.autoTimer);

    // Hədəf seç
    const hedef = avtomatikSise(user.salon, user.sandalye);
    if (!hedef) return;

    io.to('salon_' + user.salon).emit('cevir', user.sandalye, hedef);
    console.log('[sise]', user.kullaniciadi, 'spinner=' + user.sandalye, 'hedef=' + hedef);

    // 6sn sonra ortaya gətir
    setTimeout(() => {
      io.to('salon_' + user.salon).emit('ortayaGetir', user.sandalye, hedef);
      // 8sn sonra geri dön + növbəti sıra
      setTimeout(() => {
        io.to('salon_' + user.salon).emit('geriDon');
        setTimeout(() => spinSiraSonraki(user.salon), 1000);
      }, 8000);
    }, 6000);
  });

  /* ── Öpüşmə seçimi ── */
  socket.on('optumseni', (ne) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    // ne: 1=öp, 0=öpme
    io.to('salon_' + user.salon).emit('neoldu', 1, ne);
  });

  socket.on('opucuk', (hedef) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    io.to('salon_' + user.salon).emit('opucukvar', user.sandalye, hedef);
    io.to('salon_' + user.salon).emit('neoldu', 2, 1);
  });

  /* ── Chat mesajı ── */
  socket.on('mesaj', (text, hedef) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    const msg = { user: { kullaniciadi: user.kullaniciadi, cinsiyet: user.cinsiyet, id: user.id }, text, hedef: hedef || ' ' };

    // Tarixə yaz
    const hist = chatHistory.get(user.salon) || [];
    hist.push(msg);
    if (hist.length > 50) hist.shift();
    chatHistory.set(user.salon, hist);

    io.to('salon_' + user.salon).emit('mesaj', msg.user, text, hedef || ' ');
  });

  /* ── Hədiyyə ── */
  socket.on('hediye', (koltuk, hediyeId) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    const salon = getSalon(user.salon);

    const r1 = user.cinsiyet === 'female' ? '#CD3467' : '#089CDE';
    const r2 = salon['sandalye' + koltuk + 'cinsiyet'] === 'female' ? '#CD3467' : '#089CDE';

    io.to('salon_' + user.salon).emit('hediyevar',
      user.sandalye, koltuk, hediyeId,
      user.kullaniciadi,
      salon['sandalye' + koltuk + 'ad'],
      r1, r2, user.id,
      salon['sandalye' + koltuk]
    );

    // Puan güncelle (mock)
    user.opucuk = (user.opucuk || 0) + 1;
    io.to('salon_' + user.salon).emit('puanguncelle', user.id, user.opucuk, user.sandalye);
  });

  /* ── Şapka hədiyyəsi ── */
  socket.on('sapkahediye', (koltuk, hediyeId) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    const salon = getSalon(user.salon);

    const r1 = user.cinsiyet === 'female' ? '#CD3467' : '#089CDE';
    const r2 = salon['sandalye' + koltuk + 'cinsiyet'] === 'female' ? '#CD3467' : '#089CDE';

    io.to('salon_' + user.salon).emit('sapkavar',
      user.sandalye, koltuk, hediyeId,
      user.kullaniciadi,
      salon['sandalye' + koltuk + 'ad'],
      r1, r2, user.id,
      salon['sandalye' + koltuk]
    );
  });

  /* ── Profil bax ── */
  socket.on('profilebak', (userId) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    const salon = getSalon(user.salon);

    // userId ilə koltuk tap
    let hedefKoltuk = null;
    for (let i = 1; i <= 12; i++) {
      if (String(salon['sandalye' + i]) === String(userId) || salon['sandalye' + i + 'ad'] === userId) {
        hedefKoltuk = i;
        break;
      }
    }
    if (!hedefKoltuk) return;

    socket.emit('p', {
      kullaniciadi: salon['sandalye' + hedefKoltuk + 'ad'],
      fbid:         salon['sandalye' + hedefKoltuk + 'fb'],
      opucuk:       salon['sandalye' + hedefKoltuk + 'muck'],
      seviye:       salon['sandalye' + hedefKoltuk + 'tip'],
      sandalye:     hedefKoltuk,
      id:           userId,
    });
  });

  /* ── YouTube musiqi ── */
  socket.on('sarki', (link) => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    aktifSarki.set(user.salon, { link, fbid: user.fbid || user.id, kullaniciadi: user.kullaniciadi });
    io.to('salon_' + user.salon).emit('sarkivar', link, user.fbid || user.id, user.kullaniciadi);
  });

  socket.on('sarkikapat', () => {
    const user = users.get(socket.id);
    if (!user || !user.salon) return;
    aktifSarki.delete(user.salon);
    io.to('salon_' + user.salon).emit('dinledurdur');
  });

  /* ── Bağlantı kəsildi ── */
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user && user.salon) _salonTerk(socket, user);
    users.delete(socket.id);
    herkeseSalonListesi();
    console.log('Ayrıldı:', socket.id);
  });
});

/* ── Salonu tərk et (yardımcı) ── */
function _salonTerk(socket, user) {
  const salon  = getSalon(user.salon);
  const koltuk = user.sandalye;

  // Koltuğu boşalt
  salon['sandalye' + koltuk]          = 0;
  salon['sandalye' + koltuk + 'ad']   = '';
  salon['sandalye' + koltuk + 'fb']   = '';
  salon['sandalye' + koltuk + 'muck'] = 0;

  // Spin növbəsindən çıxar
  const spin = salon.spin;
  const idx  = spin.queue.indexOf(koltuk);
  if (idx !== -1) {
    spin.queue.splice(idx, 1);
    if (spin.idx >= spin.queue.length) spin.idx = 0;
  }

  socket.to('salon_' + user.salon).emit('gidenvar', koltuk, user.kullaniciadi);
  socket.leave('salon_' + user.salon);

  // Növbəti sıra
  if (spin.queue.length > 0) {
    spinSiraSonraki(user.salon);
  }

  user.salon    = null;
  user.sandalye = null;
}

/* ══ SAĞLIK ══ */
app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    users:   users.size,
    salonlar: salonlar.size,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Butulka server işləyir:', PORT));
