"use client";

import { useState, FormEvent } from "react";
import Link from 'next/link';

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


export default function FindPasswordPage() {
    const [userid, setUserid] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [idExists, setIdExists] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleIdCheck = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (userid === 'admin') { 
            setIdExists(true);
        } else {
            alert('존재하지 않는 아이디입니다.');
        }
        setIsLoading(false);
    };

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (newPassword.length < 6) {
            setError('비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Password changed for user: ${userid}`);
        
        setIsLoading(false);
        alert('비밀번호가 성공적으로 변경되었습니다. 로그인 페이지로 이동합니다.');
        
        window.location.href = '/';
    };

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4" style={{
            backgroundImage: `radial-gradient(circle at top left, hsla(214, 40%, 20%, 1) 0%, hsla(214, 40%, 10%, 1) 40%), radial-gradient(circle at bottom right, hsla(280, 50%, 25%, 1) 0%, hsla(280, 50%, 10%, 1) 40%)`,
        }}>
            <div className="w-full max-w-md rounded-2xl bg-black/50 backdrop-blur-xl shadow-2xl shadow-blue-500/10 border border-blue-500/20 overflow-hidden">
                <div className="p-6 text-center border-b border-blue-500/20">
                    <h1 className="text-2xl font-bold tracking-wider text-blue-100 uppercase">비밀번호 찾기</h1>
                    <p className="text-sm text-blue-300/70 mt-1">가입 시 사용한 아이디를 입력하여 계정을 확인합니다.</p>
                </div>
                
                <div className="p-8">
                    {!idExists ? (
                        <form className="space-y-6" onSubmit={handleIdCheck}>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon /></div>
                                <input id="id" name="id" type="text" autoComplete="username" required value={userid} onChange={(e) => setUserid(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="사용자 ID" />
                            </div>
                            <div>
                                <button type="submit" disabled={isLoading} className="w-full py-3 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all transform hover:scale-105">
                                    {isLoading ? '확인 중...' : '아이디 확인'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handlePasswordChange}>
                             <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon /></div>
                                <input type="text" readOnly value={userid} className="w-full pl-10 pr-4 py-3 bg-gray-900/70 border-2 border-gray-700 rounded-lg" />
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon /></div>
                                <input id="newPassword" name="newPassword" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" placeholder="새 비밀번호" />
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon /></div>
                                <input id="confirmPassword" name="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border-2 border-gray-700 rounded-lg placeholder-gray-400 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" placeholder="새 비밀번호 확인" />
                            </div>
                            {error && <p className="text-red-500 text-sm text-center py-2">{error}</p>}
                            <div>
                                <button type="submit" disabled={isLoading} className="w-full py-3 font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg shadow-green-500/30 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 transition-all transform hover:scale-105">
                                    {isLoading ? '변경 중...' : '비밀번호 변경'}
                                </button>
                            </div>
                        </form>
                    )}
                    <div className="mt-8 text-sm text-center">
                        <Link href="/" className="text-gray-400 hover:text-blue-300 transition-colors">로그인 페이지로 돌아가기</Link>
                    </div>
                </div>
            </div>
        </main>
    );
}