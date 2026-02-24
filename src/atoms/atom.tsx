import { User } from "@/types/user";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const loginUserAtom = atomWithStorage<User | null>('__loginUserInfo__', null);

export const dashboardReloadTriggerAtom = atom<number>(0);