import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // POST 요청이 아니면 튕겨냄
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log("=== 패스키 등록 시작 ===");
    
    // 1. 환경변수 확인 (이제 함수 안에서 안전하게 불러옵니다)
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_ANON_KEY;
    const rpID = process.env.RP_ID || 'localhost';

    console.log("환경변수 체크:", { sbUrl: !!sbUrl, sbKey: !!sbKey, rpID });

    if (!sbUrl || !sbKey) {
      throw new Error('Vercel에 Supabase 환경변수가 설정되지 않았습니다.');
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClient(sbUrl, sbKey);

    // 3. DB에서 유저 조회
    console.log("DB에서 유저 조회 중...");
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'master_user')
      .single();

    if (userError || !user) {
      throw new Error('users 테이블에서 master_user를 찾을 수 없습니다.');
    }
    console.log("유저 확인 완료:", user.id);

    // 4. 기존 패스키 확인
    const { data: passkeys } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', user.id);

    const formattedPasskeys = passkeys?.map(key => {
      // credential_id가 문자열이든 버퍼이든 안전하게 바이트 배열로 변환
      let idBuffer;
      if (typeof key.credential_id === 'string') {
        // Base64URL 또는 일반 문자열인 경우
        let base64 = key.credential_id.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const binaryString = Buffer.from(base64, 'base64');
        idBuffer = Array.from(binaryString);
      } else {
        idBuffer = Array.from(Buffer.from(key.credential_id));
      }

      return {
        id: idBuffer,
        type: 'public-key'
      };
    }) || [];
    
    // 5. 질문(Challenge) 옵션 생성
    console.log("옵션 생성 중...");
    const options = await generateRegistrationOptions({
      rpName: '이혜원 포트폴리오 (비공개)',
      rpID: rpID,
      userID: Buffer.from(user.id, 'utf-8'),
      userName: user.username,
      excludeCredentials: formattedPasskeys, // 수정된 배열 전달
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      }
    });

    console.log("옵션 생성 완료, DB에 Challenge 저장 중...");
    // 6. DB에 질문 저장
    const { error: insertError } = await supabase.from('auth_challenges').insert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'registration'
    });

    if (insertError) {
      throw new Error('Challenge 저장 실패: ' + insertError.message);
    }

    console.log("모든 과정 성공! 프론트엔드로 데이터 전송");
    return res.status(200).json(options);

  } catch (error) {
    // 이제 서버가 기절하지 않고, 에러의 진짜 이유를 화면으로 친절하게 보내줍니다.
    console.error('API 내부 에러 발생:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
