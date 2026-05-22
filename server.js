require('dotenv').config(); // .env 파일의 암호를 읽어옴
const express = require('express');
const cors = require('cors');
const axios = require('axios'); 
const { Pool } = require('pg'); 

// 🌟 웹소켓 서버를 위한 기본 라이브러리 추가
const http = require('http');
const { Server } = require('socket.io'); 

const app = express();
app.use(cors());
app.use(express.json()); 

// ==========================================
// 1. PostgreSQL DB 연결 설정 (Supabase 클라우드 DB용)
// ==========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // 외부 클라우드 DB 접속 시 필수
  }
});

// 🌟 웹소켓 설정을 위해 서버 생성 및 래핑
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 모든 도메인에서의 웹소켓 접근 허용
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 🌟 웹소켓 실시간 이벤트 정의 및 기기 룸(Room) 관리
// ==========================================
io.on('connection', (socket) => {
  console.log('🔗 새로운 연결 시도 (Socket ID:', socket.id, ')');

  // 라즈베리파이가 접속 후 자신의 고유 기기 ID를 등록할 때 호출
  socket.on('register_machine', (data) => {
    const machineId = data.machine_id;
    socket.join(machineId); // 🌟 해당 기기를 전용 룸(Room)에 입장시킴
    console.log(`🤖 자판기 기기 등록 완료: [${machineId}] 방에 입장함`);
  });

  socket.on('disconnect', () => {
    console.log('❌ 연결 종료됨 (Socket ID:', socket.id, ')');
  });
});

// ==========================================
// 2. 결제 API (카카오페이 / 토스페이)
// ==========================================
app.post('/api/payment/ready', async (req, res) => {
  const { itemName, price, quantity, domain } = req.body;
  try {
    const response = await axios.post('https://open-api.kakaopay.com/online/v1/payment/ready', {
      cid: 'TC0ONETIME',
      partner_order_id: 'order_1234',
      partner_user_id: 'user_1234',
      item_name: itemName,
      quantity: quantity,
      total_amount: price,
      vat_amount: 0,
      tax_free_amount: 0,
      approval_url: `${domain}/success`,
      cancel_url: `${domain}/cancel`,
      fail_url: `${domain}/fail`,
    }, {
      headers: {
        'Authorization': `SECRET_KEY ${process.env.KAKAO_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("카카오페이 에러:", error.response?.data || error.message);
    res.status(500).json({ message: "결제 준비 중 오류가 발생했습니다." });
  }
});

app.post('/api/toss/confirm', async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const secretKey = process.env.TOSS_SECRET_KEY; 

  if (!secretKey) return res.status(500).json({ message: '서버 환경 변수 설정 오류' });

  const encryptedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');
  try {
    const response = await axios.post('https://api.tosspayments.com/v1/payments/confirm', {
      paymentKey, orderId, amount
    }, {
      headers: {
        'Authorization': `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
      }
    });
    res.status(200).json({ message: '결제 성공', data: response.data });
  } catch (error) {
    console.error("토스페이 에러:", error.response?.data || error.message);
    res.status(400).json({ message: "결제 승인 실패", error: error.response?.data || "알 수 없는 에러" });
  }
});

// ==========================================
// 3. 자판기 상품 DB 관리 API
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY slot_number ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('DB 조회 에러:', err);
    res.status(500).json({ error: '상품 목록을 불러오지 못했습니다.' });
  }
});

app.post('/api/products', async (req, res) => {
  const { slot_number, name, price, stock, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (slot_number, name, price, stock, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [slot_number, name, price, stock, category || '기타']
    );
    res.json({ success: true, product: result.rows });
  } catch (err) {
    console.error('DB 등록 에러:', err);
    res.status(500).json({ error: '상품 등록에 실패했습니다.' });
  }
});

// ==========================================
// 4. 자판기 구매 (재고 차감 및 특정 자판기로 웹소켓 원격 명령 전송)
// ==========================================
app.post('/api/purchase', async (req, res) => {
  const { product_id, machine_id } = req.body; // 🌟 프론트엔드에서 준 machine_id 수신
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 재고 차감 (0보다 클 때만)
    const updateRes = await client.query(
      'UPDATE products SET stock = stock - 1 WHERE product_id = $1 AND stock > 0 RETURNING *',
      [product_id]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('재고가 없거나 상품을 찾을 수 없습니다.');
    }

    // 판매 기록
    await client.query(
      'INSERT INTO sales (product_id) VALUES ($1)',
      [product_id]
    );

    await client.query('COMMIT');
    
    // 🌟 차감 성공 시, 해당 상품의 물리적 슬롯 번호를 획득
    const productInfo = updateRes.rows;

    // 🌟 오직 결제가 일어난 해당 자판기(machine_id 방)에게만 실시간 배출 명령(slot_number) 전송
    if (machine_id) {
      io.to(machine_id).emit('DISPENSE_ITEM', { slot: productInfo.slot_number });
      console.log(`📡 [${machine_id}] 방으로 배출 명령 송신 성공: 슬롯 ${productInfo.slot_number}`);
    } else {
      console.log('⚠️ 경고: 요청에 machine_id가 전달되지 않아 하드웨어 명령을 전송하지 못했습니다.');
    }

    res.json({ success: true, product: updateRes.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 서버 실행 (기존 app.listen 대신 웹소켓 처리가 래핑된 server.listen 사용 필수!)
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  print(`🚀 백엔드 및 실시간 웹소켓 서버가 포트 ${PORT}에서 작동 중입니다!`);
});