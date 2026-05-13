import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, UserPlus } from "lucide-react";
import { InstallPWAButton } from "@/components/InstallPWA";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profileImageUrl?: string;
}

interface ProfileMenuProps {
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onStartDirectMessage: (userId: string) => void;
  onAddToGroup: (userId: string) => void;
}

export default function ProfileMenu({ 
  userId, 
  position, 
  onClose, 
  onStartDirectMessage, 
  onAddToGroup 
}: ProfileMenuProps) {
  return (
    <>
      {/* Menu */}
      <div
        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 min-w-[160px]"
        style={{
          left: position.x + 10,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-left"
            onClick={() => {
              onStartDirectMessage(userId);
              onClose();
            }}
            data-testid={`profile-menu-dm-${userId}`}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Send Direct Message
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-left"
            onClick={() => {
              onAddToGroup(userId);
              onClose();
            }}
            data-testid={`profile-menu-add-group-${userId}`}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add to Group Chat
          </Button>
        </div>
      </div>

      <InstallPWAButton />

      {/* Click outside to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
    </>
  );
}