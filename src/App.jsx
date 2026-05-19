import React, { useState, useEffect } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';

// 🎨 스타일 코드
const styles = {
  container: { display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#F9F9FB', fontFamily: 'sans-serif', margin: 0, padding: 0 },
  content: { width: '100%', maxWidth: '800px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  headerTitle: { fontSize: '32px', fontWeight: '900', margin: '20px 0 10px', color: '#2D3142' },
  subTitle: { fontSize: '18px', color: '#9094A6', marginBottom: '30px' },
  categoryWrapper: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px', width: '100%', justifyContent: 'center' },
  categoryButton: { padding: '10px 20px', borderRadius: '25px', backgroundColor: '#FFF', border: '1px solid #E0E5EC', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: '#9094A6', transition: '0.3s' },
  categoryButtonActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B', color: '#FFF' },
  gridContainer: { display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' },
  productCard: { backgroundColor: '#FFF', width: '200px', padding: '20px', borderRadius: '20px', boxShadow: '0 8px 15px rgba(140, 146, 172, 0.15)', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s' },
  soldOutCard: { opacity: 0.5, cursor: 'not-allowed' },
  categoryBadge: { position: 'absolute', top: '15px', left: '15px', backgroundColor: '#F0F2F5', padding: '5px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', color: '#4F5D75' },
  productName: { fontSize: '18px', fontWeight: '800', marginTop: '30px', color: '#2D3142' },
  productPrice: { fontSize: '18px', fontWeight: '700', color: '#FF6B6B', margin: '10px 0' },
  soldOutText: { color: 'red', fontWeight: 'bold', margin: 0 },
  selectedInfoBox: { backgroundColor: '#FFF', padding: '40px', borderRadius: '25px', marginBottom: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 20px rgba(140, 146, 172, 0.1)' },
  selectedProductName: { fontSize: '24px', fontWeight: '800', margin: '0 0 10px 0', color: '#2D3142' },
  selectedProductPrice: { fontSize: '24px', color: '#FF6B6B', fontWeight: '900', margin: 0 },
  buttonRow: { display: 'flex', gap: '15px', width: '100%', maxWidth: '600px', flexWrap: 'wrap', justifyContent: 'center' }, 
  payButton: { flex: '1 1 150px', padding: '20px', borderRadius: '15px', border: 'none', fontSize: '18px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  cancelButton: { marginTop: '30px', background: 'none', border: 'none', fontSize: '18px', color: '#9094A6', textDecoration: 'underline', cursor: 'pointer' },
  successEmoji: { fontSize: '80px', margin: '0 0 20px 0' },
  homeButton: { marginTop: '40px', backgroundColor: '#2D3142', color: '#FFF', padding: '20px 40px', borderRadius: '15px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
  adminSection: { marginTop: '50px', padding: '20px', backgroundColor: '#E0E5EC', borderRadius: '15px', width: '100%' },
  adminInput: { padding: '10px', margin: '5px', borderRadius: '5px', border: '1px solid #ccc' }
};

const CATEGORIES = ['전체', '포토카드', '키링', '인형'];
const BACKEND_URL = 'https://vending-backend-qlb7.onrender.com';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(false);
  
  // DB 연동 상태
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ slot_number: '', name: '', price: '', stock: '', category: '포토카드' });

  // 🔄 1. DB에서 상품 목록 가져오기 (절대 지우면 안 되는 핵심 코드)
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

  // 🔄 2. 결제 완료 후 DB 재고 차감 요청 함수
  const processPurchaseDB = async (productId) => {
    try {
      await fetch(`${BACKEND_URL}/api/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      });
      fetchProducts(); // 재고 갱신
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

      if (paymentKey) {
        confirmTossPayment(paymentKey, orderId, amount, pendingProductId);
      } else {
        if (pendingProductId) processPurchaseDB(pendingProductId);
        setCurrentScreen('Success');
        localStorage.removeItem('pending_product_id');
        window.history.pushState({}, '', '/'); 
      }
    } else if (path.includes('/cancel') || path.includes('/fail')) {
      alert("결제가 취소되었거나 실패했습니다.");
      localStorage.removeItem('pending_product_id');
      window.history.pushState({}, '', '/');
    }
  }, []);

  const confirmTossPayment = async (paymentKey, orderId, amount, pendingProductId) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/toss/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      
      if (response.ok) {
        if (pendingProductId) await processPurchaseDB(pendingProductId); 
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
      window.history.pushState({}, '', '/'); 
    }
  };

  const requestKakaoPay = async () => {
    setLoading(true);
    localStorage.setItem('pending_product_id', selectedProduct.product_id); 
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
    await processPurchaseDB(selectedProduct.product_id);
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

  // 🛠️ 진짜 에러를 화면에 띄워주도록 수정된 관리자 상품 등록 핸들러
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          price: parseInt(newProduct.price),
          stock: parseInt(newProduct.stock)
        })
      });

      const result = await response.json(); 

      if (response.ok) {
        // 서버에서 성공 신호(200)를 받았을 때만 알림 띄우고 목록 새로고침
        alert('✅ 상품이 성공적으로 등록되었습니다!');
        setNewProduct({ slot_number: '', name: '', price: '', stock: '', category: '포토카드' });
        fetchProducts(); 
      } else {
        // 백엔드에서 에러가 터졌으면 사용자에게 알려줌
        alert(`❌ 등록 실패: ${result.error || '알 수 없는 DB 오류'}`);
      }
    } catch (e) {
      alert(`통신 실패: 백엔드 서버에 연결할 수 없습니다. (${e.message})`);
    }
  };

  // 🆕 slot_number 값을 읽어서 한글 카테고리로 변환해주는 함수
  const getCategoryFromSlot = (slotNumber) => {
    if (!slotNumber) return '기타';
    
    // 소문자로 변환해서 검사 (대소문자 실수 방지)
    const slot = slotNumber.toLowerCase(); 
    
    if (slot.includes('photo')) return '포토카드';
    if (slot.includes('key')) return '키링';
    if (slot.includes('doll')) return '인형';
    return '기타'; // 위 단어들이 안 들어가 있으면 '기타'로 분류
  };

  // 🆕 선택된 카테고리에 맞춰 slot_number 기준으로 상품 필터링
  const filteredGoods = selectedCategory === '전체' 
    ? products 
    : products.filter(item => getCategoryFromSlot(item.slot_number) === selectedCategory);

  return (
    <div style={styles.container}>
      {currentScreen === 'Home' && (
        <div style={styles.content}>
          <h1 style={styles.headerTitle}>✨ 굿즈 자판기 ✨</h1>
          <p style={styles.subTitle}>원하시는 굿즈를 선택해주세요</p>
          
          <div style={styles.categoryWrapper}>
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                style={selectedCategory === cat ? { ...styles.categoryButton, ...styles.categoryButtonActive } : styles.categoryButton}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={styles.gridContainer}>
            {filteredGoods.map(item => (
              <div 
                key={item.product_id} 
                style={item.stock <= 0 ? { ...styles.productCard, ...styles.soldOutCard } : styles.productCard}
                onClick={() => handleSelectProduct(item)}
              >
                {/* 🛠️ 이 부분을 DB의 category 대신 getCategoryFromSlot 함수를 쓰도록 변경 */}
                <div style={styles.categoryBadge}>{getCategoryFromSlot(item.slot_number)}</div>
                
                <h3 style={styles.productName}>{item.name}</h3>
                <p style={styles.productPrice}>{item.price.toLocaleString()}원</p>
                {item.stock <= 0 && <p style={styles.soldOutText}>품절</p>}
              </div>
            ))}
          </div>

          <div style={styles.adminSection}>
            <h3 style={{marginTop: 0}}>🛠 상품 DB 등록 (관리자)</h3>
            <form onSubmit={handleAddProduct}>
              <input style={styles.adminInput} placeholder="슬롯(예: A1)" value={newProduct.slot_number} onChange={(e) => setNewProduct({...newProduct, slot_number: e.target.value})} required/>
              <input style={styles.adminInput} placeholder="상품명" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} required/>
              <input style={styles.adminInput} type="number" placeholder="가격" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} required/>
              <input style={styles.adminInput} type="number" placeholder="재고" value={newProduct.stock} onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})} required/>
              <select style={styles.adminInput} value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}>
                <option value="포토카드">포토카드</option>
                <option value="키링">키링</option>
                <option value="인형">인형</option>
              </select>
              <button type="submit" style={{padding: '10px 20px', borderRadius: '5px', cursor: 'pointer'}}>DB 저장</button>
            </form>
          </div>
        </div>
      )}

      {currentScreen === 'Payment' && selectedProduct && (
        <div style={styles.content}>
          <h1 style={styles.headerTitle}>결제 진행 💳</h1>
          
          <div style={styles.selectedInfoBox}>
            <h2 style={styles.selectedProductName}>{selectedProduct.name}</h2>
            <h2 style={styles.selectedProductPrice}>{selectedProduct.price.toLocaleString()}원</h2>
          </div>

          <p style={styles.subTitle}>결제 방식을 선택해주세요</p>

          <div style={styles.buttonRow}>
            <button style={{ ...styles.payButton, backgroundColor: '#FEE500', color: '#000' }} onClick={requestKakaoPay} disabled={loading}>
              {loading ? '준비 중...' : '💬 카카오페이'}
            </button>
            <button style={{ ...styles.payButton, backgroundColor: '#3182F6', color: '#FFF' }} onClick={requestTossPay} disabled={loading}>
              {loading ? '준비 중...' : '🔵 토스페이'}
            </button>
            <button style={{ ...styles.payButton, backgroundColor: '#FF6B6B', color: '#FFF' }} onClick={handleDirectPay} disabled={loading}>
              🏷️ 카드결제
            </button>
          </div>

          <button style={styles.cancelButton} onClick={handleReset}>
            취소하고 처음으로
          </button>
        </div>
      )}

      {currentScreen === 'Success' && (
        <div style={styles.content}>
          <div style={styles.successEmoji}>🎉</div>
          <h1 style={styles.headerTitle}>결제 완료!</h1>
          <p style={styles.subTitle}>자판기에서 상품이 배출됩니다.</p>
          <button style={styles.homeButton} onClick={handleReset}>
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}