import React from 'react';
import { Card, CardTier, Student } from '../types';
import { CARD_MAP, TIERS } from '../constants';

interface InventoryProps {
  student: Student | null;
  filter: CardTier | 'ALL';
  onCardClick: (cardName: string) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ student, filter, onCardClick }) => {
  if (!student || !student.inventory) {
    return (
      <div className="col-span-full text-center py-10 text-gray-400 font-bold text-sm">
        請先選擇學生或背包空空如也
      </div>
    );
  }

  const cards = Object.entries(student.inventory)
    .filter(([cardName, count]) => {
      if ((count as number) <= 0) return false;
      const card = CARD_MAP[cardName];
      if (!card) return false;
      if (filter !== 'ALL' && card.tier !== filter) return false;
      return true;
    });

  if (cards.length === 0) {
    return (
      <div className="col-span-full text-center py-10 text-gray-400 font-bold text-sm">
        此分類沒有卡片
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {cards.map(([cardName, count]) => {
        const card = CARD_MAP[cardName];
        return (
          <div
            key={cardName}
            onClick={() => onCardClick(cardName)}
            className={`card ${TIERS[card.tier]} p-4 flex flex-col justify-between min-h-[140px]`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-3xl drop-shadow-sm">{card.icon}</span>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/50 mb-1">
                  {card.tier}
                </span>
                <span className="text-xs font-black bg-gray-900 text-white px-2 py-0.5 rounded-full">
                  x{count}
                </span>
              </div>
            </div>
            <div>
              <h4 className="font-black text-sm mb-1">{cardName}</h4>
              <p className="text-[10px] opacity-80 leading-tight line-clamp-2">{card.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
