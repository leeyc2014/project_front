// 로그인 정보용
export type User = {
    id : string,
    name : string,
    role : 'USER' | 'ADMIN'
}

// 회원 관리용
export interface Member {
    id : string;
    name : string;
    role : 'USER' | 'ADMIN';
    enabled : boolean;
}