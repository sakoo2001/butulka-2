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
app.get('/', (req, res) => res.json({ status: 'ok', users: Object.keys(oyuncular).length }));

/* ══════════════════════════════════════════
   VERİ YAPILARI (RAM - DB yoxdur)
══════════════════════════════════════════ */

const oyuncular = {};  // id -> oyuncu obj
const socketMap = {};  // socketId -> oyuncu id
const chatTarix = {};  // salonId -> son 50 msg

// Salonları yarat
const salonlar = {};
for (let i = 1; i <= 5; i++) {
  const sid = 'salon' + i;
  salonlar[sid] = {
    id: sid, salonid: i, ad: 'Salon ' + i, online: 0,
    sarki: '0', sarkifb: '0', sarkiad: '0',
    durum: 0, rakip: 13, numara: 0, sira: 1,
    sandalye1:0,sandalye2:0,sandalye3:0,sandalye4:0,sandalye5:0,sandalye6:0,
    sandalye7:0,sandalye8:0,sandalye9:0,sandalye10:0,sandalye11:0,sandalye12:0,
    sandalye1ad:'0',sandalye2ad:'0',sandalye3ad:'0',sandalye4ad:'0',sandalye5ad:'0',sandalye6ad:'0',
    sandalye7ad:'0',sandalye8ad:'0',sandalye9ad:'0',sandalye10ad:'0',sandalye11ad:'0',sandalye12ad:'0',
    sandalye1fb:0,sandalye2fb:0,sandalye3fb:0,sandalye4fb:0,sandalye5fb:0,sandalye6fb:0,
    sandalye7fb:0,sandalye8fb:0,sandalye9fb:0,sandalye10fb:0,sandalye11fb:0,sandalye12fb:0,
    sandalye1muck:0,sandalye2muck:0,sandalye3muck:0,sandalye4muck:0,sandalye5muck:0,sandalye6muck:0,
    sandalye7muck:0,sandalye8muck:0,sandalye9muck:0,sandalye10muck:0,sandalye11muck:0,sandalye12muck:0,
    sandalye1tip:0,sandalye2tip:0,sandalye3tip:0,sandalye4tip:0,sandalye5tip:0,sandalye6tip:0,
    sandalye7tip:0,sandalye8tip:0,sandalye9tip:0,sandalye10tip:0,sandalye11tip:0,sandalye12tip:0,
    sandalye1cinsiyet:'0',sandalye2cinsiyet:'0',sandalye3cinsiyet:'0',sandalye4cinsiyet:'0',
    sandalye5cinsiyet:'0',sandalye6cinsiyet:'0',sandalye7cinsiyet:'0',sandalye8cinsiyet:'0',
    sandalye9cinsiyet:'0',sandalye10cinsiyet:'0',sandalye11cinsiyet:'0',sandalye12cinsiyet:'0',
    sandalye1hediye:0,sandalye2hediye:0,sandalye3hediye:0,sandalye4hediye:0,sandalye5hediye:0,sandalye6hediye:0,
    sandalye7hediye:0,sandalye8hediye:0,sandalye9hediye:0,sandalye10hediye:0,sandalye11hediye:0,sandalye12hediye:0,
    sandalye1sapkahediye:0,sandalye2sapkahediye:0,sandalye3sapkahediye:0,sandalye4sapkahediye:0,
    sandalye5sapkahediye:0,sandalye6sapkahediye:0,sandalye7sapkahediye:0,sandalye8sapkahediye:0,
    sandalye9sapkahediye:0,sandalye10sapkahediye:0,sandalye11sapkahediye:0,sandalye12sapkahediye:0,
    sandalye1id:0,sandalye2id:0,sandalye3id:0,sandalye4id:0,sandalye5id:0,sandalye6id:0,
    sandalye7id:0,sandalye8id:0,sandalye9id:0,sandalye10id:0,sandalye11id:0,sandalye12id:0,
  };
}

/* ══════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
══════════════════════════════════════════ */

function salonListesi() {
  return Object.values(salonlar).map(s => ({
    id: s.id, ad: s.ad, salonid: s.salonid, online: s.online
  }));
}

function salonlariYayinla() {
  io.emit('salonlar', salonListesi());
}

function hediyeSeviye(ne) {
  const map = {
    sirkele:1, yaprak:1, Gift9813:1, Gift9806:1, Gift9807:1,
    Gift9842:2, Gift9808:2, 'Gift9815v2':2, Gift9816:2, Gift9817:2,
    Gift9819:3, Gift9820:3, Gift9821:3, Gift9823:3,
    Gift9869:4, Gift9828:4, Gift9830:4,
    Gift9845:5, Gift9874:5, Gift9877:5, Gift9878:5,
    Gift9879:6, Gift9881:6, Gift9832:6, sapka1:6,
    sapka2:7, sapka3:7, sapka5:7, sapka7:7,
  };
  return map[ne] || 0;
}

/* ══ SPIN: Növbəti sıra ══ */
function siragec(mekan, koltuk) {
  const salon = salonlar[mekan];
  if (!salon) return;
  let suan = koltuk;
  let tapdimi = 0;
  for (let x = 1; x <= 12; x++) {
    suan++;
    if (suan > 12) suan = 1;
    if (salon['sandalye' + suan + 'cinsiyet'] !== '0') {
      tapdimi = 1;
      salon.sira = suan;
      salon.durum = 0;
      salon.numara = 0;
      salon.rakip = 13;
      io.to(mekan).emit('geriDon');
      io.to(mekan).emit('sira', suan);
      break;
    }
  }
  if (!tapdimi) {
    salon.sira = 1;
    salon.durum = 0;
    salon.numara = 0;
    io.to(mekan).emit('geriDon');
    io.to(mekan).emit('sira', 1);
  }
}

/* ══ SPIN: Şişəni çevir ══ */
function baslatiyoruz(s) {
  const salon = salonlar[s];
  if (!salon) return;
  const yer = salon.sira;

  if (salon['sandalye' + yer] === 0) {
    siragec(s, yer);
    return;
  }
  if (salon.durum === 1) return; // Artıq oyun gedir

  const cevirenCinsiyet = salon['sandalye' + yer + 'cinsiyet'];
  if (!cevirenCinsiyet || cevirenCinsiyet === '0') {
    siragec(s, yer);
    return;
  }

  // Qarşı cinsdən rakib tap
  const karsiCinsiyet = cevirenCinsiyet === 'male' ? 'female' : 'male';
  const rakipler = [];
  for (let i = 1; i <= 12; i++) {
    if (i !== yer && salon['sandalye' + i + 'cinsiyet'] === karsiCinsiyet) {
      rakipler.push(i);
    }
  }

  if (rakipler.length === 0) {
    // Eyni cinsdən rakib tap
    for (let i = 1; i <= 12; i++) {
      if (i !== yer && salon['sandalye' + i + 'cinsiyet'] !== '0') {
        rakipler.push(i);
      }
    }
  }

  if (rakipler.length === 0) {
    salon.durum = 0;
    return;
  }

  const rakip = rakipler[Math.floor(Math.random() * rakipler.length)];
  const no = Date.now();

  salon.durum = 1;
  salon.rakip = rakip;
  salon.numara = no;

  io.to(s).emit('cevir', yer, rakip);

  const t1 = setTimeout(() => {
    if (salonlar[s] && salonlar[s].durum === 1 && salonlar[s].sira === yer && salonlar[s].numara === no) {
      io.to(s).emit('ortayaGetir', yer, rakip);
    }
  }, 6000);

  const t2 = setTimeout(() => {
    if (salonlar[s] && salonlar[s].durum === 1 && salonlar[s].sira === yer && salonlar[s].numara === no) {
      io.to(s).emit('geriDon');
    }
  }, 13000);

  setTimeout(() => {
    if (salonlar[s] && salonlar[s].durum === 1 && salonlar[s].sira === yer && salonlar[s].numara === no) {
      salonlar[s].durum = 0;
      salonlar[s].numara = 0;
      salonlar[s].rakip = 13;
      siragec(s, yer);
    }
  }, 15000);
}

// Hər 17 saniyə spin avtomatik başlat
setInterval(() => {
  for (const key in salonlar) {
    if (salonlar[key].online >= 2 && salonlar[key].durum === 0) {
      baslatiyoruz(key);
    }
  }
}, 17000);

/* ══ Salona gir ══ */
function salonagir(oyuncuId, istenenSalon, fn) {
  const oyuncu = oyuncular[oyuncuId];
  if (!oyuncu) return fn(false, false);
  const salon = salonlar[istenenSalon];
  if (!salon) return fn(false, false);
  if (oyuncu.salon !== 'salon0') return fn(false, false);

  let buraya = 0;
  for (let i = 1; i <= 12; i++) {
    if (salon['sandalye' + i] === 0) { buraya = i; break; }
  }
  if (!buraya) return fn(false, false);

  salon['sandalye' + buraya]           = oyuncu.fbid || oyuncu.id;
  salon['sandalye' + buraya + 'ad']    = oyuncu.kullaniciadi;
  salon['sandalye' + buraya + 'fb']    = oyuncu.fbid || oyuncu.id;
  salon['sandalye' + buraya + 'cinsiyet'] = oyuncu.cinsiyet;
  salon['sandalye' + buraya + 'hediye']   = oyuncu.hediye || 0;
  salon['sandalye' + buraya + 'muck']     = oyuncu.opucuk;
  salon['sandalye' + buraya + 'tip']      = oyuncu.seviye;
  salon['sandalye' + buraya + 'id']       = oyuncu.id;
  salon['sandalye' + buraya + 'sapkahediye'] = oyuncu.sapkahediye || 0;
  salon.online++;

  oyuncular[oyuncuId].salon    = istenenSalon;
  oyuncular[oyuncuId].sandalye = buraya;

  io.emit('up', salon.online, istenenSalon);
  fn(buraya, salon);
}

/* ══ Salonu tərk et ══ */
function saloncik(oyuncuId, fn) {
  const oyuncu = oyuncular[oyuncuId];
  if (!oyuncu) return fn(false, false);
  const salon = salonlar[oyuncu.salon];
  if (!salon) return fn(false, false);
  const bu = oyuncu.sandalye;
  const ilgiliSalon = oyuncu.salon;

  if (salon.online > 0) salon.online--;
  salon['sandalye' + bu] = 0;
  salon['sandalye' + bu + 'fb'] = 0;
  salon['sandalye' + bu + 'tip'] = 0;
  salon['sandalye' + bu + 'muck'] = 0;
  salon['sandalye' + bu + 'id'] = 0;
  salon['sandalye' + bu + 'ad'] = '0';
  salon['sandalye' + bu + 'cinsiyet'] = '0';
  salon['sandalye' + bu + 'hediye'] = 0;
  salon['sandalye' + bu + 'sapkahediye'] = 0;

  io.emit('up', salon.online, ilgiliSalon);
  fn(ilgiliSalon, bu);
}

/* ══ Öpüşmə / seviyə ══ */
function opucukEkle(oyuncuId, hedefKoltuk, kim) {
  // kim=1: çeviren öpüyor, kim=2: rakip öpüyor
  const ben = oyuncular[oyuncuId];
  if (!ben) return;
  const salon = salonlar[ben.salon];
  if (!salon) return;

  const hedefId = salon['sandalye' + hedefKoltuk + 'id'];
  const hedef = oyuncular[hedefId];
  if (!hedef) return;

  // Opucuk artır
  salon['sandalye' + hedefKoltuk + 'muck']++;
  hedef.opucuk++;
  hedef.yuzdelik = (hedef.yuzdelik || 0) + 1;

  io.to(ben.salon).emit('kisup', hedef, hedefKoltuk, salon['sandalye' + hedefKoltuk + 'muck']);
  io.to(ben.salon).emit('neoldu', kim, 1);

  // Seviyə sistemi
  if (hedef.yuzdelik > 99) {
    hedef.yuzdelik = 0;
    hedef.seviye++;
    salon['sandalye' + hedef.sandalye + 'tip'] = hedef.seviye;
    io.to(ben.salon).emit('yuzdelik', hedef.sandalye, hedef.id, hedef.seviye, hedef.yuzdelik);
    io.to(ben.salon).emit('levelatladi', hedef.fbid || hedef.id, hedef.kullaniciadi, hedef.id, hedef.seviye);
  } else {
    io.to(ben.salon).emit('yuzdelik', hedef.sandalye, hedef.id, hedef.seviye, hedef.yuzdelik);
  }
}

/* ══════════════════════════════════════════
   SOCKET.IO BAĞLANTILAR
══════════════════════════════════════════ */

io.on('connection', (socket) => {
  console.log('[+] Bağlandı:', socket.id);

  /* ── Giriş ── */
  socket.on('giris', (userData) => {
    let user;
    if (typeof userData === 'object' && userData !== null) {
      user = {
        id:           userData.id || socket.id,
        fbid:         userData.fbid || userData.id || socket.id,
        kullaniciadi: userData.kullaniciadi || 'Oyuncu',
        cinsiyet:     userData.cinsiyet || 'male',
        opucuk:       userData.opucuk || 0,
        seviye:       userData.seviye || 1,
        yetki:        userData.yetki || 0,
        yuzdelik:     userData.yuzdelik || 0,
        hediye:       0,
        sapkahediye:  0,
        salon:        'salon0',
        sandalye:     0,
      };
    } else {
      // Köhnə sistem — string serial
      user = {
        id: String(userData), fbid: String(userData),
        kullaniciadi: 'Oyuncu', cinsiyet: 'male',
        opucuk: 0, seviye: 1, yetki: 0, yuzdelik: 0,
        hediye: 0, sapkahediye: 0, salon: 'salon0', sandalye: 0,
      };
    }

    // Köhnə bağlantını təmizlə
    if (oyuncular[user.id]) {
      delete oyuncular[user.id];
    }

    oyuncular[user.id]  = user;
    socketMap[socket.id] = user.id;
    socket.username      = user.id;
    socket.room          = 'salon0';
    socket.join('salon0');

    socket.emit('hi', {
      id: user.id, opucuk: user.opucuk,
      seviye: user.seviye, yetki: user.yetki, yuzdelik: user.yuzdelik
    });
    socket.emit('salonlar', salonListesi());
    console.log('[giris]', user.kullaniciadi, user.id);
  });

  /* ── Salona gir ── */
  socket.on('salonON', (data) => {
    if (!socket.username) return;
    salonagir(socket.username, data, (r1, r2) => {
      if (r1 === false) return;
      socket.leave(socket.room);
      socket.room = data;
      socket.join(data);
      socket.emit('salongiris', r2, r1);

      // Musiqi durumu
      if (r2.sarki === '0') {
        socket.emit('dinledurdur');
      } else {
        socket.emit('sarkivar', r2.sarki, r2.sarkifb, r2.sarkiad);
      }

      // Seviyə bilgisi
      const me = oyuncular[socket.username];
      if (me) socket.emit('yuzdelik', r1, me.id, me.seviye, me.yuzdelik || 0);

      // Chat tarixi
      const hist = chatTarix[data] || [];
      hist.forEach(m => socket.emit('mesaj', m.user, m.text, m.hedef));

      // Digərlərinə bildir
      socket.broadcast.to(data).emit('gelenvar', r2, r1);

      // Sıra bildirimi
      const salon = salonlar[data];
      if (salon) socket.emit('sira', salon.sira);

      salonlariYayinla();
    });
  });

  /* ── Salonu tərk et ── */
  socket.on('salonOFF', () => {
    if (!socket.username) return;
    saloncik(socket.username, (r1, r2) => {
      if (r1 === false) return;
      socket.leave(socket.room);
      socket.room = 'salon0';
      socket.join('salon0');
      socket.emit('dinledurdur');
      socket.emit('saloncikis');
      io.to(r1).emit('gidenvar', r2, oyuncular[socket.username]?.kullaniciadi || '');
      if (oyuncular[socket.username]) {
        oyuncular[socket.username].salon    = 'salon0';
        oyuncular[socket.username].sandalye = 0;
      }
      salonlariYayinla();
    });
  });

  /* ── Şişəni çevir (manual) ── */
  socket.on('sise', () => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon) return;
    // Sırası gəlmişmi?
    if (salon.sira !== ben.sandalye) return;
    if (salon.durum === 1) return;
    baslatiyoruz(ben.salon);
  });

  /* ── Chat ── */
  socket.on('mesaj', (data, x) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon || ben.salon === 'salon0') return;

    const msg = { user: { kullaniciadi: ben.kullaniciadi, cinsiyet: ben.cinsiyet, id: ben.id }, text: data, hedef: x || ' ' };
    const hist = chatTarix[ben.salon] || [];
    hist.push(msg);
    if (hist.length > 50) hist.shift();
    chatTarix[ben.salon] = hist;

    io.to(ben.salon).emit('mesaj', msg.user, data, x || ' ');
  });

  /* ── Öpüşmə seçimi ── */
  socket.on('opucuk', (data) => {
    if (!socket.username) return;
    if (data !== 1 && data !== 2) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon) return;

    if (salon.sira === ben.sandalye || salon.rakip === ben.sandalye) {
      if (data === 1) {
        // Öptü
        if (salon.sira === ben.sandalye) {
          opucukEkle(socket.username, salon.rakip, 1);
        } else {
          opucukEkle(socket.username, salon.sira, 2);
        }
      } else {
        // Öpmədi
        if (salon.sira === ben.sandalye) {
          io.to(ben.salon).emit('neoldu', 1, 0);
        } else {
          io.to(ben.salon).emit('neoldu', 2, 0);
        }
      }
    }
  });

  /* ── Öpücük at (hədiyyə) ── */
  socket.on('optumseni', (kime) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon) return;
    if (salon['sandalye' + kime] === 0) return;
    const kisiId = salon['sandalye' + kime + 'id'];
    const kisi   = oyuncular[kisiId];
    if (!kisi) return;
    if (ben.opucuk < 2) {
      io.to(ben.salon).emit('puanguncellered', socket.username);
      return;
    }
    // 2 puan al, 1 puan ver
    ben.opucuk -= 2;
    salon['sandalye' + ben.sandalye + 'muck'] -= 2;
    kisi.opucuk++;
    salon['sandalye' + kime + 'muck']++;
    io.to(ben.salon).emit('opucukvar', ben.sandalye, kime);
    io.to(ben.salon).emit('puanguncelle', socket.username, ben.opucuk, ben.sandalye);
    io.to(ben.salon).emit('puanguncelle', kisiId, kisi.opucuk, kisi.sandalye);
  });

  /* ── Hədiyyə ── */
  socket.on('hediye', (kime, ne) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon || salon['sandalye' + kime] === 0) return;
    const kisiId = salon['sandalye' + kime + 'id'];
    const kisi   = oyuncular[kisiId];
    if (!kisi) return;
    if (ben.opucuk <= 0) {
      socket.emit('puanguncellered', socket.username);
      return;
    }
    const gerekliSeviye = hediyeSeviye(ne);
    if (ben.seviye < gerekliSeviye) return;

    // Hədiyyəni saxla
    if (!['Gift9813','yaprak','sirkele','paradok','Gift9842'].includes(ne)) {
      kisi.hediye = ne;
      salon['sandalye' + kime + 'hediye'] = ne;
    }

    ben.opucuk--;
    salon['sandalye' + ben.sandalye + 'muck']--;

    const r1 = ben.cinsiyet === 'male' ? '#089CDE' : '#CD3467';
    const r2 = kisi.cinsiyet === 'male' ? '#089CDE' : '#CD3467';

    io.to(ben.salon).emit('hediyevar', ben.sandalye, kime, ne,
      ben.kullaniciadi, kisi.kullaniciadi, r1, r2, ben.id, kisi.id);
    io.to(ben.salon).emit('puanguncelle', socket.username, ben.opucuk, ben.sandalye);
  });

  /* ── Şapka hədiyyəsi ── */
  socket.on('sapkahediye', (kime, ne) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon || salon['sandalye' + kime] === 0) return;
    const kisiId = salon['sandalye' + kime + 'id'];
    const kisi   = oyuncular[kisiId];
    if (!kisi) return;
    if (ben.opucuk <= 0) {
      socket.emit('puanguncellered', socket.username);
      return;
    }
    const gerekliSeviye = hediyeSeviye(ne);
    if (ben.seviye < gerekliSeviye) return;

    ben.opucuk--;
    salon['sandalye' + ben.sandalye + 'muck']--;
    kisi.sapkahediye = ne;
    salon['sandalye' + kime + 'sapkahediye'] = ne;

    const r1 = ben.cinsiyet === 'male' ? '#089CDE' : '#CD3467';
    const r2 = kisi.cinsiyet === 'male' ? '#089CDE' : '#CD3467';

    io.to(ben.salon).emit('sapkavar', ben.sandalye, kime, ne,
      ben.kullaniciadi, kisi.kullaniciadi, r1, r2, ben.id, kisi.id);
    io.to(ben.salon).emit('puanguncelle', socket.username, ben.opucuk, ben.sandalye);
  });

  /* ── Profil bax ── */
  socket.on('profilebak', (data) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const o = oyuncular[data];
    if (o) socket.emit('p', o);
  });

  /* ── YouTube musiqi ── */
  socket.on('istek', _sarkiHandle);
  socket.on('sarki', _sarkiHandle);

  function _sarkiHandle(data) {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const salon = salonlar[ben.salon];
    if (!salon || ben.salon === 'salon0') return;
    salonlar[ben.salon].sarki   = data;
    salonlar[ben.salon].sarkifb = ben.fbid || ben.id;
    salonlar[ben.salon].sarkiad = ben.kullaniciadi;
    io.to(socket.room).emit('sarkivar', data, ben.fbid || ben.id, ben.kullaniciadi);
    setTimeout(() => { io.to(socket.room).emit('denetim'); }, 3000);
  }

  socket.on('sarkikapat', () => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben) return;
    const s = salonlar[ben.salon];
    if (s) {
      s.sarki = '0'; s.sarkifb = '0'; s.sarkiad = '0';
    }
    io.to(ben.salon).emit('dinledurdur');
  });

  /* ── Ban ── */
  socket.on('wandet', (k) => {
    if (!socket.username) return;
    const ben = oyuncular[socket.username];
    if (!ben || ben.yetki <= 0) return;
    io.to(ben.salon).emit('wa', k);
    console.log('[ban]', k);
  });

  /* ── Disconnect ── */
  socket.on('disconnect', () => {
    const uid = socketMap[socket.id];
    if (!uid) return;
    const ben = oyuncular[uid];
    if (ben) {
      if (ben.salon !== 'salon0') {
        const salon = salonlar[ben.salon];
        if (salon) {
          if (salon.online > 0) salon.online--;
          const bu = ben.sandalye;
          salon['sandalye' + bu] = 0;
          salon['sandalye' + bu + 'fb'] = 0;
          salon['sandalye' + bu + 'tip'] = 0;
          salon['sandalye' + bu + 'muck'] = 0;
          salon['sandalye' + bu + 'id'] = 0;
          salon['sandalye' + bu + 'ad'] = '0';
          salon['sandalye' + bu + 'cinsiyet'] = '0';
          salon['sandalye' + bu + 'hediye'] = 0;
          salon['sandalye' + bu + 'sapkahediye'] = 0;
          io.emit('up', salon.online, ben.salon);
          io.to(ben.salon).emit('gidenvar', bu, ben.kullaniciadi);
        }
      }
      delete oyuncular[uid];
    }
    delete socketMap[socket.id];
    console.log('[-] Ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Butulka server işləyir:', PORT));
