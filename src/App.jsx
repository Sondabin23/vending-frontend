import React, { useState, useEffect } from 'react';
// 🆕 [토스페이 추가] 토스페이먼츠 SDK 임포트
import { loadTossPayments } from '@tosspayments/payment-sdk';

// 🎨 스타일 코드 (변경 없음)
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
  buttonRow: { display: 'flex', gap: '15px', width: '100%', maxWidth: '600px', flexWrap: 'wrap', justifyContent: 'center' }, // 간격 살짝 조정
  payButton: { flex: '1 1 150px', padding: '20px', borderRadius: '15px', border: 'none', fontSize: '18px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  cancelButton: { marginTop: '30px', background: 'none', border: 'none', fontSize: '18px', color: '#9094A6', textDecoration: 'underline', cursor: 'pointer' },
  successEmoji: { fontSize: '80px', margin: '0 0 20px 0' },
  homeButton: { marginTop: '40px', backgroundColor: '#2D3142', color: '#FFF', padding: '20px 40px', borderRadius: '15px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }
};

// 📦 자판기 상품 데이터 (변경 없음)
const CATEGORIES = ['전체', '포토카드', '키링', '인형'];
const GOODS = [
  { id: '1', name: '홀로그램 포카 세트', price: 1, stock: 15, category: '포토카드' },
  { id: '2', name: '투명 미공포', price: 3000, stock: 0, category: '포토카드' },
  { id: '3', name: '아크릴 키링', price: 8000, stock: 5, category: '키링' },
  { id: '4', name: '메탈 스트랩 키링', price: 9500, stock: 3, category: '키링' },
  { id: '5', name: '10cm 솜인형', price: 15000, stock: 10, category: '인형' },
  { id: '6', name: '20cm 공식 인형', price: 25000, stock: 2, category: '인형' },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(false);

  // 🔄 URL 감지 및 토스페이 결제 최종 승인 처리
  useEffect(() => {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    // 🆕 [토스페이 추가] 토스 결제 후 돌아오면 URL에 이런 값들이 붙어 있습니다.
    const paymentKey = urlParams.get('paymentKey');
    const orderId = urlParams.get('orderId');
    const amount = urlParams.get('amount');

    if (path.includes('/success')) {
      if (paymentKey) {
        // 🆕 [토스페이 추가] 토스페이먼츠는 프론트로 돌아온 후 서버로 최종 승인 요청을 보내야 합니다.
        confirmTossPayment(paymentKey, orderId, amount);
      } else {
        // 카카오페이 등 일반적인 성공 처리
        setCurrentScreen('Success');
        window.history.pushState({}, '', '/'); 
      }
    } else if (path.includes('/cancel') || path.includes('/fail')) {
      alert("결제가 취소되었거나 실패했습니다.");
      window.history.pushState({}, '', '/');
    }
  }, []);

  // 🆕 [토스페이 추가] 백엔드로 토스 결제 최종 승인 요청을 보내는 함수
  const confirmTossPayment = async (paymentKey, orderId, amount) => {
    setLoading(true);
    try {
      const response = await fetch('/api/toss/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      const result = await response.json();

      if (response.ok) {
        setCurrentScreen('Success');
      } else {
        alert(`토스 결제 승인 실패: ${result.message}`);
        setCurrentScreen('Home');
      }
    } catch (e) {
      alert(`통신 에러: ${e.toString()}`);
      setCurrentScreen('Home');
    } finally {
      setLoading(false);
      window.history.pushState({}, '', '/'); // URL 깔끔하게 정리
    }
  };

  // 🚀 기존 카카오페이 요청 로직 (변경 없음)
  const requestKakaoPay = async () => {
    setLoading(true);
    const DOMAIN = window.location.origin; 
    try {
      const response = await fetch('/api/payment/ready', {
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
        if (redirectUrl) {
          window.location.href = redirectUrl; 
        } else {
          alert('결제창 주소를 받아오지 못했습니다.');
        }
      } else {
        alert(`결제 에러: ${result.message || '알 수 없는 오류'}`);
      }
    } catch (e) {
      alert(`통신 에러: ${e.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 [토스페이 추가] 토스페이 결제창 띄우기 로직
  const requestTossPay = async () => {
    setLoading(true);
    const DOMAIN = window.location.origin;

    try {
      // 1. 발급받은 클라이언트 키로 초기화 (발급받은 테스트 키로 꼭 변경하세요!)
      const clientKey = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'; // <- 토스 개발자센터 클라이언트 키 입력
      const tossPayments = await loadTossPayments(clientKey);

      // 2. 결제창 호출
      await tossPayments.requestPayment('토스페이', {
        amount: selectedProduct.price,
        orderId: 'TOSS_' + new Date().getTime(), // 임의의 주문번호 생성
        orderName: selectedProduct.name,
        customerName: '자판기 고객',
        // 결제 완료 후 돌아올 URL (기존 로직이 /success 를 감지하므로 동일하게 설정)
        successUrl: `${DOMAIN}/success`, 
        failUrl: `${DOMAIN}/fail`,
      });
      // requestPayment 호출 시 페이지가 토스 결제창으로 이동하기 때문에 아래 코드는 실행되지 않습니다.
    } catch (error) {
      if (error.code === 'USER_CANCEL') {
        alert('사용자가 결제를 취소했습니다.');
      } else {
        alert(`결제 창 호출 에러: ${error.message}`);
      }
      setLoading(false);
    }
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

  const filteredGoods = selectedCategory === '전체' ? GOODS : GOODS.filter(g => g.category === selectedCategory);

  return (
    <div style={styles.container}>
      {/* 1. 홈 화면 (상품 목록) */}
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
                key={item.id} 
                style={item.stock <= 0 ? { ...styles.productCard, ...styles.soldOutCard } : styles.productCard}
                onClick={() => handleSelectProduct(item)}
              >
                <div style={styles.categoryBadge}>{item.category}</div>
                <h3 style={styles.productName}>{item.name}</h3>
                <p style={styles.productPrice}>{item.price.toLocaleString()}원</p>
                {item.stock <= 0 && <p style={styles.soldOutText}>품절</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 결제 대기 화면 */}
      {currentScreen === 'Payment' && selectedProduct && (
        <div style={styles.content}>
          <h1 style={styles.headerTitle}>결제 진행 💳</h1>
          
          <div style={styles.selectedInfoBox}>
            <h2 style={styles.selectedProductName}>{selectedProduct.name}</h2>
            <h2 style={styles.selectedProductPrice}>{selectedProduct.price.toLocaleString()}원</h2>
          </div>

          <p style={styles.subTitle}>결제 방식을 선택해주세요</p>

          <div style={styles.buttonRow}>
            {/* 기존 카카오페이 버튼 */}
            <button 
              style={{ ...styles.payButton, backgroundColor: '#FEE500', color: '#000' }} 
              onClick={requestKakaoPay} 
              disabled={loading}
            >
              {loading ? '준비 중...' : '💬 카카오페이'}
            </button>
            
            {/* 🆕 [토스페이 추가] 토스페이 버튼 */}
            <button 
              style={{ ...styles.payButton, backgroundColor: '#3182F6', color: '#FFF' }} 
              onClick={requestTossPay} 
              disabled={loading}
            >
              {loading ? '준비 중...' : '🔵 토스페이'}
            </button>

            {/* 기존 RFID 버튼 */}
            <button 
              style={{ ...styles.payButton, backgroundColor: '#FF6B6B', color: '#FFF' }} 
              onClick={() => setCurrentScreen('Success')}
            >
              🏷️ 카드결제
            </button>
          </div>

          <button style={styles.cancelButton} onClick={handleReset}>
            취소하고 처음으로
          </button>
        </div>
      )}

      {/* 3. 결제 성공 화면 */}
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