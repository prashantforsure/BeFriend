import { useCallback } from 'react';

const useWhatsApp = () => {
  const redirectToWhatsApp = useCallback(
    (phoneNumber: string, message: string = "Hi") => {
      if (!phoneNumber) return;
      const formattedNumber = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber}`;
      const encodedMessage = encodeURIComponent(message);
      const waUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
      window.location.href = waUrl;
    },
    []
  );

  return { redirectToWhatsApp };
};

export default useWhatsApp;
