import React, { useState, useEffect } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import './appp.css'; 

const CATEGORIES = ['전체', '포토카드', '키링', '인형'];
const BACKEND_URL = 'https://vending-backend-qlb7.onrender.com';
const MACHINE_ID = 'VENDING_01'; 

// 🌟 키오스크 화면 크기(태블릿 등)에 맞춰 한 화면에 보여줄 상품 개수 설정 (필요시 4나 6으로 수정)
const ITEMS_PER_PAGE = 4; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  
  // 🌟 현재 페이지 번호 상태 추가
  const [currentPage, setCurrentPage] = useState(1);

  // 카테고리가 바뀌면 무조건 1페이지로 돌아가기
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/products`);
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      console.error("상품 불러오기 실패:", e);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const processPurchaseDB = async (productId, slotNumber) => {
    try {
      await fetch(`${BACKEND_URL}/api/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_id: productId,
          machine_id: MACHINE_ID,
          slot_number: slotNumber 
        })
      });
      fetchProducts(); 
    } catch (e) {
      console.error("DB 재고 차감 실패:", e);
    }
  };

  useEffect(() => {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    const paymentKey = urlParams.get('paymentKey');
    const orderId = urlParams.get('orderId');
    const amount = urlParams.get('amount');

    if (path.includes('/success')) {
      const pendingProductId = localStorage.getItem('pending_product_id');
      const pendingSlotNumber = localStorage.getItem('pending_slot_number'); 

      if (paymentKey) {
        confirmTossPayment(paymentKey, orderId, amount, pendingProductId, pendingSlotNumber);
      } else {
        if (pendingProductId && pendingSlotNumber) processPurchaseDB(pendingProductId, pendingSlotNumber);
        setCurrentScreen('Success');
        localStorage.removeItem('pending_product_id');
        localStorage.removeItem('pending_slot_number');
        window.history.pushState({}, '', '/'); 
      }
    } else if (path.includes('/cancel') || path.includes('/fail')) {
      alert("결제가 취소되었거나 실패했습니다.");
      localStorage.removeItem('pending_product_id');
      localStorage.removeItem('pending_slot_number');
      window.history.pushState({}, '', '/');
    }
  }, []);

  const confirmTossPayment = async (paymentKey, orderId, amount, pendingProductId, pendingSlotNumber) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/toss/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      
      if (response.ok) {
        if (pendingProductId && pendingSlotNumber) await processPurchaseDB(pendingProductId, pendingSlotNumber); 
        setCurrentScreen('Success');
      } else {
        alert("토스 결제 승인 실패");
        setCurrentScreen('Home');
      }
    } catch (e) {
      alert(`통신 에러: ${e.toString()}`);
      setCurrentScreen('Home');
    } finally {
      setLoading(false);
      localStorage.removeItem('pending_product_id');
      localStorage.removeItem('pending_slot_number');
      window.history.pushState({}, '', '/'); 
    }
  };

  const requestKakaoPay = async () => {
    setLoading(true);
    localStorage.setItem('pending_product_id', selectedProduct.product_id); 
    localStorage.setItem('pending_slot_number', selectedProduct.slot_number); 
    try {
      const response = await fetch(`${BACKEND_URL}/api/payment/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: selectedProduct.name,
          price: selectedProduct.price,
          quantity: 1, 
          domain: window.location.origin
        }),
      });
      const result = await response.json();
      if (response.ok) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        window.location.href = isMobile ? result.next_redirect_mobile_url : result.next_redirect_pc_url; 
      } else {
        alert(`결제 에러: ${result.message}`);
      }
    } catch (e) {
      alert(`통신 에러`);
    } finally { setLoading(false); }
  };

  const requestTossPay = async () => {
    setLoading(true);
    localStorage.setItem('pending_product_id', selectedProduct.product_id); 
    localStorage.setItem('pending_slot_number', selectedProduct.slot_number); 
    try {
      const tossPayments = await loadTossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq');
      await tossPayments.requestPayment('토스페이', {
        amount: selectedProduct.price,
        orderId: 'TOSS_' + new Date().getTime(), 
        orderName: selectedProduct.name,
        customerName: '고객',
        successUrl: `${window.location.origin}/success`, 
        failUrl: `${window.location.origin}/fail`,
      });
    } catch (error) {
      setLoading(false);
    }
  };

  const handleDirectPay = async () => {
    setLoading(true);
    await processPurchaseDB(selectedProduct.product_id, selectedProduct.slot_number); 
    setCurrentScreen('Success');
    setLoading(false);
  };

  const handleSelectProduct = (product) => {
    if (product.stock <= 0) return;
    setSelectedProduct(product);
    setCurrentScreen('Payment');
  };

  // 🌟 카테고리 필터링
  const filteredGoods = selectedCategory === '전체' 
    ? products 
    : products.filter(item => item.category === selectedCategory);

  // 🌟 페이징 계산 로직
  const totalPages = Math.ceil(filteredGoods.length / ITEMS_PER_PAGE) || 1;
  const currentGoods = filteredGoods.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="container">
      
      {/* 고정 헤더 */}
      <div className="header">
        <h1 className="header-title">JWD_Vending_Machine</h1>
      </div>

      {currentScreen === 'Home' && (
        <div className="content">
          <div className="story-wrapper">
            {CATEGORIES.map(cat => (
              <div key={cat} className="story-item" onClick={() => setSelectedCategory(cat)}>
                <div className={`story-ring ${selectedCategory === cat ? 'active' : ''}`}>
                  <div className="story-circle">
                    {cat === '전체' ? 'ALL' : cat.substring(0, 2)}
                  </div>
                </div>
                <span className="story-text">{cat}</span>
              </div>
            ))}
          </div>

          <div className="grid-container">
            {/* 🌟 전체 상품 대신 현재 페이지에 해당하는 상품(currentGoods)만 렌더링 */}
            {currentGoods.map(item => (
              <div 
                key={item.product_id} 
                className={`product-card ${item.stock <= 0 ? 'sold-out-card' : ''}`}
                onClick={() => handleSelectProduct(item)}
              >
                <div className="card-header">
                  <div className="card-avatar">{item.category.substring(0, 1)}</div>
                  <span className="card-username">{item.category}_official</span>
                </div>
                
                <div className="card-image">
                  {item.name}
                </div>
                
                <div className="card-footer">
                  <div className="card-actions">🤍 💬 ✈️</div>
                  <div className="card-price">{item.price.toLocaleString()}원</div>
                  <div className="card-stock">
                    {item.stock <= 0 ? '🚫 품절된 상품입니다' : `남은 수량: ${item.stock}개`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 🌟 하단 페이지 넘김 컨트롤 */}
          <div className="pagination-wrapper">
            <button 
              className="page-btn" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              &lt;
            </button>
            <span className="page-info">{currentPage} / {totalPages}</span>
            <button 
              className="page-btn" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              &gt;
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'Payment' && selectedProduct && (
        <div className="content" style={{justifyContent: 'center'}}>
          <div className="payment-wrapper">
            <div className="payment-title">결제 방식 선택</div>
            <div className="payment-product">{selectedProduct.name}</div>
            <div className="payment-price">{selectedProduct.price.toLocaleString()}원</div>

            <button className="pay-btn kakao" onClick={requestKakaoPay} disabled={loading}>
              {loading ? '준비 중...' : '카카오페이'}
            </button>
            <button className="pay-btn toss" onClick={requestTossPay} disabled={loading}>
              {loading ? '준비 중...' : '토스페이'}
            </button>
            <button className="pay-btn card" onClick={handleDirectPay} disabled={loading}>
              일반 카드결제
            </button>

            <button className="back-btn" onClick={() => { setSelectedProduct(null); setCurrentScreen('Home'); }}>
              취소하고 돌아가기
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'Success' && (
        <div className="content" style={{justifyContent: 'center'}}>
          <div className="payment-wrapper">
            <div className="success-emoji">🎉</div>
            <div className="payment-title">결제가 완료되었습니다!</div>
            <p style={{ color: '#8E8E8E', marginBottom: '30px' }}>자판기에서 상품을 꺼내주세요.</p>
            <button className="pay-btn card" onClick={() => { setSelectedProduct(null); setCurrentScreen('Home'); }}>
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}