import React, { useState, useEffect } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import './appp.css'; 

const CATEGORIES = ['전체', '포토카드', '키링', '인형'];
const BACKEND_URL = 'https://vending-backend-qlb7.onrender.com';
const MACHINE_ID = 'VENDING_01'; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);

  // 🔄 DB에서 상품 목록 가져오기
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

  // 🔄 결제 완료 후 DB 재고 차감 및 기기 배출 요청 함수
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

  // 🔄 URL 감지 및 결제 최종 승인 처리
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
        if (pendingProductId && pendingSlotNumber) {
          processPurchaseDB(pendingProductId, pendingSlotNumber);
        }
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
        if (pendingProductId && pendingSlotNumber) {
          await processPurchaseDB(pendingProductId, pendingSlotNumber); 
        }
        setCurrentScreen('Success');
      } else {
        const result = await response.json();
        alert(`토스 결제 승인 실패: ${result.message}`);
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
    const DOMAIN = window.location.origin; 
    try {
      const response = await fetch(`${BACKEND_URL}/api/payment/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: selectedProduct.name,
          price: selectedProduct.price,
          quantity: 1, 
          domain: DOMAIN
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const redirectUrl = isMobile ? result.next_redirect_mobile_url : result.next_redirect_pc_url;
        if (redirectUrl) window.location.href = redirectUrl; 
      } else {
        alert(`결제 에러: ${result.message}`);
      }
    } catch (e) {
      alert(`통신 에러: ${e.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const requestTossPay = async () => {
    setLoading(true);
    localStorage.setItem('pending_product_id', selectedProduct.product_id); 
    localStorage.setItem('pending_slot_number', selectedProduct.slot_number); 
    const DOMAIN = window.location.origin;

    try {
      const clientKey = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'; 
      const tossPayments = await loadTossPayments(clientKey);

      await tossPayments.requestPayment('토스페이', {
        amount: selectedProduct.price,
        orderId: 'TOSS_' + new Date().getTime(), 
        orderName: selectedProduct.name,
        customerName: '자판기 고객',
        successUrl: `${DOMAIN}/success`, 
        failUrl: `${DOMAIN}/fail`,
      });
    } catch (error) {
      if (error.code === 'USER_CANCEL') alert('사용자가 결제를 취소했습니다.');
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

  const handleReset = () => {
    setSelectedProduct(null);
    setCurrentScreen('Home');
    setSelectedCategory('전체');
  };

  const filteredGoods = selectedCategory === '전체' 
    ? products 
    : products.filter(item => item.category === selectedCategory);

  return (
    <div className="container">
      {currentScreen === 'Home' && (
        <div className="content">
          <h1 className="header-title">✨ 굿즈 자판기 ✨</h1>
          <p className="sub-title">원하시는 굿즈를 선택해주세요</p>
          
          <div className="category-wrapper">
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                className={`category-button ${selectedCategory === cat ? 'category-button-active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid-container">
            {filteredGoods.map(item => (
              <div 
                key={item.product_id} 
                className={`product-card ${item.stock <= 0 ? 'sold-out-card' : ''}`}
                onClick={() => handleSelectProduct(item)}
              >
                {/* 좌측 상단: 카테고리 뱃지 */}
                <div className="category-badge">{item.category}</div>
                
                <h3 className="product-name">{item.name}</h3>
                <p className="product-price">{item.price.toLocaleString()}원</p>
                
                {/* 재고가 없으면 품절 표시, 있으면 우측 하단에 재고 수량 뱃지 표시 */}
                {item.stock <= 0 ? (
                  <p className="sold-out-text">품절</p>
                ) : (
                  <div className="stock-badge">남은 수량: {item.stock}개</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentScreen === 'Payment' && selectedProduct && (
        <div className="content">
          <h1 className="header-title">결제 진행 💳</h1>
          
          <div className="selected-info-box">
            <h2 className="selected-product-name">{selectedProduct.name}</h2>
            <h2 className="selected-product-price">{selectedProduct.price.toLocaleString()}원</h2>
          </div>

          <p className="sub-title">결제 방식을 선택해주세요</p>

          <div className="button-row">
            <button className="pay-button kakao" onClick={requestKakaoPay} disabled={loading}>
              {loading ? '준비 중...' : '💬 카카오페이'}
            </button>
            <button className="pay-button toss" onClick={requestTossPay} disabled={loading}>
              {loading ? '준비 중...' : '🔵 토스페이'}
            </button>
            <button className="pay-button card" onClick={handleDirectPay} disabled={loading}>
              🏷️ 카드결제
            </button>
          </div>

          <button className="cancel-button" onClick={handleReset}>
            취소하고 처음으로
          </button>
        </div>
      )}

      {currentScreen === 'Success' && (
        <div className="content">
          <div className="success-emoji">🎉</div>
          <h1 className="header-title">결제 완료!</h1>
          <p className="sub-title">자판기에서 상품이 배출됩니다.</p>
          <button className="home-button" onClick={handleReset}>
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}