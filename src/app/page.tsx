"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect, useRef } from "react";
import { RiKakaoTalkFill } from "react-icons/ri";
import { SiNaver } from "react-icons/si";
import { FaGithub, FaGoogle } from "react-icons/fa";

// --- Helper components for icons ---
const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
);

// --- Types ---
export type User = {
    id: string;
    name: string;
    role: 'USER';
};

export default function Page() {
    // 백엔드 LoginRequest DTO의 필드명 'name'과 맞추기 위해 ref 명칭 정리
    const nameInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const [loginUser, setLoginUser] = useState<User | null>(null);
    const [loginState, setLoginState] = useState<boolean | null>(null);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();

        // 1. 백엔드 LoginRequest DTO (name, password) 규격에 맞게 데이터 구성
        const credentials = {
            name: nameInputRef.current?.value,
            password: passwordInputRef.current?.value,
        };

        if (!credentials.name || !credentials.password) {
            alert("이름과 비밀번호를 입력해주세요.");
            return;
        }

        try {
            // 2. 백엔드 주소 (CORS 설정이 백엔드에 되어 있어야 함)
            // Failed to fetch 방지를 위해 전체 URL 사용
            const response = await fetch("http://localhost:8080/api/v1/login", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(credentials),
            });

            // 응답이 JSON 형식이 아닐 경우를 대비한 처리
            if (!response.ok && response.status !== 401) {
                throw new Error("서버 응답 오류");
            }

            const result = await response.json(); // 백엔드의 LoginResponse DTO

            if (response.ok && result.success) {
                // 로그인 성공 시 로직
                alert(`로그인 성공! ${result.message}`);
                
                // JWT 토큰이 있다면 저장 (예: localStorage)
                if (result.token) {
                    sessionStorage.setItem("token", result.token);
                }

                // 대시보드로 이동
                router.push('/dashboard');
            } else {
                // 백엔드에서 보낸 실패 메시지 출력 (비번 틀림 등)
                alert(result.message || "로그인에 실패했습니다. 정보를 확인하세요.");
            }
        } catch (error) {
            console.error("로그인 통신 실패:", error);
            alert("서버와 통신할 수 없습니다. 백엔드 서버가 켜져 있는지 확인하세요.");
        }
    };

    // 기존의 useEffect 로직 유지 (불필요한 fetch는 에러 방지를 위해 주석 처리)
    useEffect(() => {
        if (!loginUser) {
            setLoginState(false);
            return;
        }
        // 추후 사용자 세션 체크 로직이 필요할 때 작성
        setLoginState(true);
    }, [loginUser]);

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4" 
              style={{
                  backgroundImage: `radial-gradient(circle at top left, hsla(214, 40%, 20%, 1) 0%, hsla(214, 40%, 10%, 1) 40%), radial-gradient(circle at bottom right, hsla(280, 50%, 25%, 1) 0%, hsla(280, 50%, 10%, 1) 40%)`,
              }}>
            <div className="w-full max-w-md rounded-2xl bg-black/50 backdrop-blur-xl shadow-2xl shadow-blue-500/10 border border-blue-500/20 overflow-hidden">
                <div className="p-6 text-center border-b border-blue-500/20">
                    <h1 className="text-2xl font-bold tracking-wider text-blue-100 uppercase">SYSTEM LOGIN</h1>
                    <p className="text-sm text-blue-300/70 mt-1">Barcode Management System</p>
                </div>

                <div className="p-8">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {/* NAME INPUT */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon />
                            </div>
                            <input 
                                id="name" 
                                name="name" 
                                type="text" 
                                autoComplete="username" 
                                required 
                                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                placeholder="사용자 이름(Name)" 
                                ref={nameInputRef} 
                            />
                        </div>
                        
                        {/* PASSWORD INPUT */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockIcon />
                            </div>
                            <input 
                                id="password" 
                                name="password" 
                                type="password" 
                                autoComplete="current-password" 
                                required 
                                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                placeholder="비밀번호" 
                                ref={passwordInputRef} 
                            />
                        </div>

                        <div>
                            <button 
                                type="submit" 
                                className="w-full py-3 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all transform hover:scale-105"
                            >
                                로그인
                            </button>
                        </div>
                    </form>

                    <div className="flex items-center my-6">
                        <div className="flex-grow border-t border-gray-600"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">소셜 로그인</span>
                        <div className="flex-grow border-t border-gray-600"></div>
                    </div>

                    <div className="flex justify-center space-x-4">
                        <a href="/auth/oauth2/authorization/google" className="flex justify-center items-center w-12 h-12 text-2xl bg-gray-800/80 rounded-full border-2 border-gray-700 hover:border-blue-500 hover:bg-gray-800 transition-all transform hover:scale-110"><FaGoogle/></a>
                        <a href="/auth/oauth2/authorization/naver"  className="flex justify-center items-center w-12 h-12 text-2xl text-white bg-gray-800/80 rounded-full border-2 border-gray-700 hover:border-green-500 hover:bg-gray-800 transition-all transform hover:scale-110"><SiNaver/></a>
                        <a href="/auth/oauth2/authorization/kakao"  className="flex justify-center items-center w-12 h-12 text-3xl bg-gray-800/80 rounded-full border-2 border-gray-700 hover:border-yellow-400 hover:bg-gray-800 transition-all transform hover:scale-110"><RiKakaoTalkFill/></a>
                        <a href="/auth/oauth2/authorization/github" className="flex justify-center items-center w-12 h-12 text-3xl bg-gray-800/80 rounded-full border-2 border-gray-700 hover:border-gray-400 hover:bg-gray-800 transition-all transform hover:scale-110"><FaGithub/></a>
                    </div>
                    
                    <div className="mt-8 text-sm text-center">
                        <a href="/find" className="text-gray-400 hover:text-blue-300 transition-colors">비밀번호를 잊으셨나요?</a>
                    </div>
                </div>
            </div>
        </main>
    );
}
