'use client';
import {createContext,useContext} from 'react';
import type {Snapshot} from '@/types/database';
export type RowInput = Record<string,unknown>;
export type SaveResult = {row:{id:string;[key:string]:unknown}; queued?:boolean};
export interface BookContext {book:Snapshot|null;error:string;refresh:()=>Promise<void>;save:(resource:string,data:RowInput,action?:string)=>Promise<SaveResult>;businessId:string;switchBusiness:(id:string)=>void;pending:number;online:boolean}
export const Book=createContext<BookContext|null>(null);
export function useBook(){const ctx=useContext(Book);if(!ctx)throw new Error('Book provider missing');return ctx;}
export const localeMoney=(p:unknown,locale='en',digits=0)=>new Intl.NumberFormat(locale+'-IN',{style:'currency',currency:'INR',minimumFractionDigits:digits,maximumFractionDigits:digits}).format((Number(p)||0)/100);
export const day=(value:unknown,locale='en')=>{const d=new Date(String(value));return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(locale+'-IN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Kolkata'});};
