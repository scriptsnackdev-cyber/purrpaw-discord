import discord
import random
import datetime
from core.ai import AI
from core.database import Database
from core.logger import get_logger

logger = get_logger("fortune")

# 1-78 Mapping as per provided table
TAROT_CARDS = {
    1: "The Magician (นักมายากล)",
    2: "The High Priestess (นักบวชหญิง)",
    3: "The Empress (จักรพรรดินี)",
    4: "The Emperor (จักรพรรดิ)",
    5: "The Hierophant (นักบวช)",
    6: "The Lovers (คนรัก)",
    7: "The Chariot (รถศึก)",
    8: "Strength (ความเข้มแข็ง)", # Uploaded as 8. Strength (RWS system)
    9: "The Hermit (ฤาษี)",
    10: "Wheel of Fortune (กงล้อแห่งโชคชะตา)",
    11: "The Hanged Man (คนแขวน)", # SHIFTED: Justice (11) is missing, 11 shows Hanged Man
    12: "Death (ความตาย)", # SHIFTED: 12 shows Death (label 13)
    13: "Temperance (ความพอดี)", # SHIFTED: 13 shows Temperance (label 14)
    14: "The Devil (ปีศาจ)", # SHIFTED: 14 shows Devil (label 15)
    15: "The Tower (หอคอย)", # SHIFTED: 15 shows Tower (label 16)
    16: "The Star (ดวงดาว)", # SHIFTED: 16 shows Star (label 17)
    17: "The Moon (ดวงจันทร์)", # SHIFTED: 17 shows Moon (label 18)
    18: "The Sun (ดวงอาทิตย์)", # SHIFTED: 18 shows Sun (label 19)
    19: "Judgement (การพิพากษา)", # SHIFTED: 19 shows Judgement (label 20)
    20: "The World (โลก)", # SHIFTED: 20 shows World (label 21)
    21: "Judgement / Custom Nick (ไพ่พิเศษ/ชื่อผิด)", # ERROR: File 21 shows "21. JUDEMENT" but image is custom/Nick
    22: "The Fool (คนโง่)",
    # NOTE: 'Justice' (11) is missing from the 1-22 uploads!

    23: "Ace of Wands (เอซไม้เท้า)",
    24: "Two of Wands (2 ไม้เท้า)",
    25: "Three of Wands (3 ไม้เท้า)",
    26: "Four of Wands (4 ไม้เท้า)",
    27: "Five of Wands (5 ไม้เท้า)",
    28: "Six of Wands (6 ไม้เท้า)",
    29: "Seven of Wands (7 ไม้เท้า)",
    30: "Eight of Wands (8 ไม้เท้า)",
    31: "Nine of Wands (9 ไม้เท้า)",
    32: "Ten of Wands (10 ไม้เท้า)",
    33: "Page of Wands (เด็กถือไม้เท้า)",
    34: "Knight of Wands (อัศวินไม้เท้า)",
    35: "Queen of Wands (ราชินีไม้เท้า)",
    36: "King of Wands (ราชาไม้เท้า)",
    37: "Ace of Cups (เอซถ้วย)",
    38: "Two of Cups (2 ถ้วย)",
    39: "Three of Cups (3 ถ้วย)",
    40: "Four of Cups (4 ถ้วย)",
    41: "Five of Cups (5 ถ้วย)",
    42: "Six of Cups (6 ถ้วย)",
    43: "Seven of Cups (7 ถ้วย)",
    44: "Eight of Cups (8 ถ้วย)",
    45: "Nine of Cups (9 ถ้วย)",
    46: "Ten of Cups (10 ถ้วย)",
    47: "Page of Cups (เด็กถือถ้วย)",
    48: "Knight of Cups (อัศวินถ้วย)",
    49: "Queen of Cups (ราชินีถ้วย)",
    50: "King of Cups (ราชาถ้วย)",
    51: "Ace of Swords (เอซดาบ)",
    52: "Two of Swords (2 ดาบ)",
    53: "Three of Swords (3 ดาบ)",
    54: "Four of Swords (4 ดาบ)",
    55: "Five of Swords (5 ดาบ)",
    56: "Six of Swords (6 ดาบ)",
    57: "Seven of Swords (7 ดาบ)",
    58: "Eight of Swords (8 ดาบ)",
    59: "Nine of Swords (9 ดาบ)",
    60: "Ten of Swords (10 ดาบ)",
    61: "Page of Swords (เด็กถือดาบ)",
    62: "Knight of Swords (อัศวินดาบ)",
    63: "Queen of Swords (ราชินีดาบ)",
    64: "King of Swords (ราชาดาบ)",
    65: "Ace of Pentacles (เอซเหรียญ)",
    66: "Two of Pentacles (2 เหรียญ)",
    67: "Three of Pentacles (3 เหรียญ)",
    68: "Four of Pentacles (4 เหรียญ)",
    69: "Five of Pentacles (5 เหรียญ)",
    70: "Six of Pentacles (6 เหรียญ)",
    71: "Seven of Pentacles (7 เหรียญ)",
    72: "Eight of Pentacles (8 เหรียญ)",
    73: "Nine of Pentacles (9 เหรียญ)",
    74: "Ten of Pentacles (10 เหรียญ)",
    75: "Page of Pentacles (เด็กถือเหรียญ)",
    76: "Knight of Pentacles (อัศวินเหรียญ)",
    77: "Queen of Pentacles (ราชินีเหรียญ)",
    78: "King of Pentacles (ราชาเหรียญ)"
}

class FortuneView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="🔮 ดูดวงชะตาของฉัน (1 ใบ)", style=discord.ButtonStyle.primary, custom_id="fortune_draw")
    async def draw_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await FortuneModule.process_fortune(interaction, None)

class FortuneModule:

    @staticmethod
    async def process_fortune(target: discord.Interaction | discord.Message, db_ctx: dict | None):
        """Processes the fortune draw for either a command or interaction."""
        user = target.user if isinstance(target, discord.Interaction) else target.author
        channel = target.channel
        
        # 1. Randomize Card (1-78)
        card_no = random.randint(1, 78)
        card_name = TAROT_CARDS.get(card_no, f"Unknown Card ({card_no})")
        card_url = f"https://cfildssrpbwqxupnorqd.supabase.co/storage/v1/object/public/public-assets/daily-fortune/{card_no}.png"

        # 2. Loading Embed
        embed = discord.Embed(
            title=f"🔮 ไพ่ทาโร่ประจำวัน: {user.display_name}",
            description="*กำลังสับไพ่อย่างตั้งใจ... Purr...* 🐾",
            color=0x8b5cf6
        )
        embed.set_image(url=card_url)
        embed.set_footer(text="ลูกแก้วของ PurrPaw กำลังเปล่งประกาย... 🕯️")
        
        if isinstance(target, discord.Interaction):
            if target.response.is_done():
                status_msg = await target.followup.send(embed=embed, wait=True)
            else:
                await target.response.send_message(embed=embed)
                status_msg = await target.original_response()
        else:
            status_msg = await channel.send(embed=embed)

        # 3. Call AI
        prompt = (
            f"You are PurrPaw, a mystical and wise cat tarot reader. "
            f"The user '{user.display_name}' has drawn the card '{card_name}' for their daily fortune. "
            f"Provide an insightful, slightly mystical prediction for their day in THAI. "
            f"Include advice on love, work, or general mood. "
            f"Keep the tone encouraging and cat-like (add subtle 'purr' or 'meow' vibes but keep it professional)."
            f"ALWAYS RESPOND ENTIRELY IN THAI LANGUAGE."
        )

        try:
            ai_response = await AI.get_simple_response(prompt, f"เปิดได้ไพ่: {card_name}", model="google/gemini-3-flash-preview")
            
            final_embed = discord.Embed(
                title=f"🔮 ไพ่ทาโร่ประจำวัน: {card_name}",
                description=ai_response,
                color=0x8b5cf6
            )
            final_embed.set_author(name=user.display_name, icon_url=user.display_avatar.url)
            final_embed.set_image(url=card_url)
            final_embed.set_footer(text="ขอให้ดวงดาวนำทางอุ้งเท้าของคุณในวันนี้! ✨")
            
            # Send result with a NEW button so others can draw too
            await status_msg.edit(embed=final_embed, view=FortuneView())
            
        except Exception as e:
            logger.error(f"❌ Fortune AI Error: {e}")
            error_embed = discord.Embed(
                title="🔮 ไพ่ทาโร่ประจำวัน: เกิดข้อผิดพลาด",
                description=f"ดวงดาวดูจะขุ่นมัวไปนิด... แต่คุณจิ้มได้ไพ่ **{card_name}** นะเมี๊ยว! 🐾",
                color=0xff4b4b
            )
            error_embed.set_image(url=card_url)
            await status_msg.edit(embed=error_embed, view=FortuneView())

    @staticmethod
    async def process_interaction(interaction: discord.Interaction):
        """Handle interaction events for fortune."""
        if interaction.data.get("custom_id") == "fortune_draw":
            await FortuneModule.process_fortune(interaction, None)
