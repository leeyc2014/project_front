export type Member = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
};

export type MemberListResponse = {
  content: Member[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
  empty?: boolean;
};

export type MemberPageInfo = {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
};

export type EditForm = {
  id: string;
  password: string;
  name: string;
  role: string;
  enabled: boolean;
};

export type CreateForm = {
  id: string;
  password: string;
  name: string;
  role: string;
};
