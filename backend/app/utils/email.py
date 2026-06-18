"""
Email Service using Resend
Handles all transactional emails
"""
import logging
from typing import Optional
import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email service using Resend API"""
    
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.FROM_EMAIL
        self.frontend_url = settings.FRONTEND_URL
        self.base_url = "https://api.resend.com"
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email via Resend API"""
        if not self.api_key:
            logger.warning("Resend API key not configured. Email not sent.")
            # In development, log the email content
            logger.info(f"[DEV EMAIL] To: {to_email}, Subject: {subject}")
            logger.info(f"[DEV EMAIL] Content: {html_content[:500]}...")
            return True  # Return True in dev mode
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": self.from_email,
                        "to": [to_email],
                        "subject": subject,
                        "html": html_content,
                        "text": text_content
                    }
                )
                
                if response.status_code == 200:
                    logger.info(f"Email sent successfully to {to_email}")
                    return True
                else:
                    logger.error(f"Failed to send email: {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Email sending error: {e}")
            return False
    
    async def send_verification_email(self, email: str, otp: str) -> bool:
        """Send email verification OTP"""
        # Always log OTP for development
        logger.info(f"🔐 OTP for {email}: {otp}")
        print(f"\n{'='*50}")
        print(f"📧 VERIFICATION OTP for {email}")
        print(f"🔑 OTP Code: {otp}")
        print(f"{'='*50}\n")
        
        subject = "Verify your DocMatrix account"
        html_content = f"""
        <!DOCTYPE html>>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; }}
                .otp-box {{ background-color: #f8fafc; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 36px; font-weight: bold; color: #1d4ed8; letter-spacing: 8px; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
                .warning {{ color: #ef4444; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📄 DocMatrix</h1>
                    <p>Email Verification</p>
                </div>
                <div class="content">
                    <h2>Welcome to DocMatrix!</h2>
                    <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    <p>This code will expire in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
                    <p class="warning">⚠️ If you didn't create a DocMatrix account, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2026 DocMatrix. All rights reserved.</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(email, subject, html_content)
    
    async def send_drive_link_otp(self, email: str, otp: str, drive_email: str) -> bool:
        """Send OTP for Google Drive linking"""
        subject = "Confirm Google Drive Linking - DocMatrix"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; }}
                .otp-box {{ background-color: #f8fafc; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 36px; font-weight: bold; color: #1d4ed8; letter-spacing: 8px; }}
                .drive-info {{ background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
                .warning {{ color: #ef4444; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📄 DocMatrix</h1>
                    <p>Google Drive Security Verification</p>
                </div>
                <div class="content">
                    <h2>Confirm Drive Linking</h2>
                    <p>Someone is attempting to link a Google Drive folder to your DocMatrix account.</p>
                    <div class="drive-info">
                        <strong>🔗 Drive Account:</strong> {drive_email}
                    </div>
                    <p>If this was you, enter the following OTP to confirm:</p>
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    <p>This code will expire in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
                    <p class="warning">⚠️ If you did not request this, please ignore this email and consider changing your password.</p>
                </div>
                <div class="footer">
                    <p>© 2026 DocMatrix. All rights reserved.</p>
                    <p>This is a security notification.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(email, subject, html_content)
    
    async def send_password_reset_otp(self, email: str, otp: str) -> bool:
        """Send password reset OTP"""
        subject = "Password Reset - DocMatrix"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; }}
                .otp-box {{ background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 36px; font-weight: bold; color: #b91c1c; letter-spacing: 8px; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
                .warning {{ color: #ef4444; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset</h1>
                    <p>DocMatrix Security</p>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>You requested to reset your password. Use the following OTP to proceed:</p>
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    <p>This code will expire in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
                    <p class="warning">⚠️ If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
                </div>
                <div class="footer">
                    <p>© 2026 DocMatrix. All rights reserved.</p>
                    <p>This is a security notification.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(email, subject, html_content)
    
    async def send_critical_action_otp(
        self,
        email: str,
        otp: str,
        action: str,
        details: Optional[str] = None
    ) -> bool:
        """Send OTP for critical actions (file deletion, account deletion, etc.)"""
        subject = f"Security Verification Required - {action}"
        details_html = f"<p><strong>Details:</strong> {details}</p>" if details else ""
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; }}
                .otp-box {{ background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 36px; font-weight: bold; color: #d97706; letter-spacing: 8px; }}
                .action-box {{ background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
                .warning {{ color: #ef4444; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚠️ Security Verification</h1>
                    <p>DocMatrix</p>
                </div>
                <div class="content">
                    <h2>Confirm Critical Action</h2>
                    <div class="action-box">
                        <strong>Requested Action:</strong> {action}
                        {details_html}
                    </div>
                    <p>Enter the following OTP to confirm this action:</p>
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    <p>This code will expire in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
                    <p class="warning">⚠️ This action cannot be undone. If you didn't request this, please secure your account immediately.</p>
                </div>
                <div class="footer">
                    <p>© 2026 DocMatrix. All rights reserved.</p>
                    <p>This is a security notification.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(email, subject, html_content)
    
    async def send_login_alert(
        self,
        email: str,
        device_info: str,
        ip_address: str,
        location: Optional[str] = None
    ) -> bool:
        """Send alert for new login"""
        subject = "New Login Detected - DocMatrix"
        location_html = f"<p><strong>Location:</strong> {location}</p>" if location else ""
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 40px 30px; }}
                .info-box {{ background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
                .warning {{ color: #ef4444; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 New Login</h1>
                    <p>DocMatrix Security Alert</p>
                </div>
                <div class="content">
                    <h2>New Login to Your Account</h2>
                    <p>We detected a new login to your DocMatrix account.</p>
                    <div class="info-box">
                        <p><strong>Device:</strong> {device_info}</p>
                        <p><strong>IP Address:</strong> {ip_address}</p>
                        {location_html}
                        <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                    </div>
                    <p class="warning">⚠️ If this wasn't you, please change your password immediately and review your active sessions.</p>
                </div>
                <div class="footer">
                    <p>© 2026 DocMatrix. All rights reserved.</p>
                    <p>This is a security notification.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(email, subject, html_content)


# Import datetime at the top level
from datetime import datetime

# Singleton instance
email_service = EmailService()