import React from 'react';
import { Student } from '../types';

interface AdminTableProps {
  students: Student[];
  isBatchMode: boolean;
  selectedStudents: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onManage: (student: Student) => void;
}

export const AdminTable: React.FC<AdminTableProps> = ({
  students,
  isBatchMode,
  selectedStudents,
  onToggleSelect,
  onSelectAll,
  onManage
}) => {
  return (
    <div className="overflow-x-auto border rounded-2xl max-h-[400px] custom-scrollbar">
      <table className="w-full text-sm text-left relative">
        <thead className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase sticky top-0 z-10 shadow-sm">
          <tr>
            {isBatchMode && (
              <th className="p-5 text-center w-20">
                <input
                  type="checkbox"
                  onChange={(e) => onSelectAll(e.target.checked)}
                  checked={students.length > 0 && selectedStudents.size === students.length}
                  className="w-5 h-5 cursor-pointer accent-primary"
                />
              </th>
            )}
            <th className="p-5">座號/姓名</th>
            <th className="p-5 text-center">點數</th>
            <th className="p-5 text-center">獎券</th>
            <th className="p-5 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((s) => (
            <tr
              key={s.id}
              className={`hover:bg-gray-50 transition-colors ${selectedStudents.has(s.id) ? 'bg-teal-50/50' : ''}`}
            >
              {isBatchMode && (
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(s.id)}
                    onChange={() => onToggleSelect(s.id)}
                    className="w-5 h-5 cursor-pointer accent-primary"
                  />
                </td>
              )}
              <td className="p-4 font-black text-gray-800">{s.name}</td>
              <td className="p-4 text-center font-black text-primary text-lg">{s.points}</td>
              <td className="p-4 text-center font-black text-secondary text-lg">{s.draws}</td>
              <td className="p-4 text-right">
                <button
                  onClick={() => onManage(s)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-[10px] font-black transition-colors"
                >
                  管理
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
