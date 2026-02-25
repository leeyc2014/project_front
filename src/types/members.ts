export type Member = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
};

export type MemberListResponse = {
  content: Member[];
  totalElements?: number;
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