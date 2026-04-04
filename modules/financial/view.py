from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.card import MDCard
from kivy.app import App
from kivy.metrics import dp
from modules.financial.controller import FinancialController
from shared.theme import (
    ACCENT, GOLD, GREEN, RED, ORANGE,
    PANEL, TEXT, TEXT_DIM, CURRENCY_SYMBOL,
    INCOME_CATEGORIES, EXPENSE_CATEGORIES,
    hex_color
)
from shared.components import top_nav


def _c(h): return hex_color(h)


class FinancialScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self._built = False
        self._summary_container = None
        self._breakdown_container = None
        self._txn_container = None
        self._goal_container = None

    def on_enter(self):
        if not self._built:
            app = App.get_running_app()
            self.ctrl = FinancialController(app.db)
            self._build()
            self._built = True
        else:
            self._update_data()

    def _update_data(self):
        self._fill_summary()
        self._fill_breakdown()
        self._fill_transactions()
        self._fill_goals()

    def _build(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(top_nav(self, "◈  FINANCIAL", ORANGE))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(16),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # ── Summary cards ─────────────────────────────────────────
        self._summary_container = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(90)
        )
        self._fill_summary()
        body.add_widget(self._summary_container)

        # ── Action buttons ────────────────────────────────────────
        btn_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(44)
        )
        inc_btn = MDRaisedButton(
            text="+ INCOME",
            md_bg_color=_c(GREEN),
            size_hint_x=0.5
        )
        inc_btn.bind(on_release=lambda x: self._go_add("income"))
        exp_btn = MDRaisedButton(
            text="+ EXPENSE",
            md_bg_color=_c(RED),
            size_hint_x=0.5
        )
        exp_btn.bind(on_release=lambda x: self._go_add("expense"))
        btn_row.add_widget(inc_btn)
        btn_row.add_widget(exp_btn)
        body.add_widget(btn_row)

        # ── Expense breakdown ─────────────────────────────────────
        body.add_widget(self._section("EXPENSE BREAKDOWN"))
        self._breakdown_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(4),
            size_hint_y=None
        )
        self._breakdown_container.bind(
            minimum_height=self._breakdown_container.setter("height"))
        self._fill_breakdown()
        body.add_widget(self._breakdown_container)

        # ── Recent transactions ───────────────────────────────────
        body.add_widget(self._section("RECENT TRANSACTIONS"))
        self._txn_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._txn_container.bind(
            minimum_height=self._txn_container.setter("height"))
        self._fill_transactions()
        body.add_widget(self._txn_container)

        hist_btn = MDFlatButton(
            text="VIEW ALL TRANSACTIONS →",
            theme_text_color="Custom",
            text_color=_c(ACCENT),
            size_hint_y=None, height=dp(40)
        )
        hist_btn.bind(on_release=lambda x: setattr(
            self.manager, "current", "transaction_history"))
        body.add_widget(hist_btn)

        # ── Goals ─────────────────────────────────────────────────
        body.add_widget(self._section("FINANCIAL GOALS"))
        self._goal_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            size_hint_y=None
        )
        self._goal_container.bind(
            minimum_height=self._goal_container.setter("height"))
        self._fill_goals()
        body.add_widget(self._goal_container)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    # ── Fill methods ──────────────────────────────────────────────

    def _fill_summary(self):
        self._summary_container.clear_widgets()
        data = self.ctrl.get_dashboard_data()
        s = data["symbol"]
        for label, val, color in [
            ("INCOME",   f"{s}{data['income']:,.2f}",   GREEN),
            ("EXPENSES", f"{s}{data['expenses']:,.2f}", RED),
            ("CASHFLOW", f"{s}{data['cashflow']:,.2f}",
             GREEN if data['cashflow'] >= 0 else RED),
        ]:
            self._summary_container.add_widget(
                self._summary_card(label, val, color))

    def _fill_breakdown(self):
        self._breakdown_container.clear_widgets()
        breakdown = self.ctrl.get_expense_breakdown()
        s = CURRENCY_SYMBOL
        if not breakdown:
            self._breakdown_container.add_widget(MDLabel(
                text="No expenses this month.",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(TEXT_DIM),
                size_hint_y=None, height=dp(28)
            ))
            return
        total_exp = sum(v for _, v in breakdown)
        for cat, amt in breakdown:
            pct = (amt / total_exp * 100) if total_exp > 0 else 0
            self._breakdown_container.add_widget(
                self._breakdown_row(cat, amt, pct, s))

    def _fill_transactions(self):
        self._txn_container.clear_widgets()
        txns = self.ctrl.get_recent_transactions(10)
        s = CURRENCY_SYMBOL
        if not txns:
            self._txn_container.add_widget(MDLabel(
                text="No transactions yet.",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(TEXT_DIM),
                size_hint_y=None, height=dp(28)
            ))
            return
        for t in txns:
            self._txn_container.add_widget(
                self._txn_row(t, s))

    def _fill_goals(self):
        self._goal_container.clear_widgets()
        goals = self.ctrl.get_goals()
        s = CURRENCY_SYMBOL
        if not goals:
            self._goal_container.add_widget(MDLabel(
                text="No goals set yet.",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=_c(TEXT_DIM),
                size_hint_y=None, height=dp(28)
            ))
            return
        for g in goals:
            self._goal_container.add_widget(
                self._goal_row(g, s))

    # ── Widget builders ───────────────────────────────────────────

    def _summary_card(self, label, value, color):
        card = MDCard(
            orientation="vertical",
            radius=[8], elevation=0,
            padding=dp(10),
            size_hint_x=1/3,
            md_bg_color=_c(PANEL)
        )
        card.add_widget(MDLabel(
            text=label,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            halign="center"
        ))
        card.add_widget(MDLabel(
            text=value,
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="center",
            bold=True
        ))
        return card

    def _breakdown_row(self, cat, amt, pct, s):
        row = MDBoxLayout(
            orientation="horizontal",
            size_hint_y=None, height=dp(28),
            spacing=dp(8)
        )
        row.add_widget(MDLabel(
            text=cat, font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT), size_hint_x=0.4
        ))
        row.add_widget(MDLabel(
            text=f"{s}{amt:,.2f}",
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(RED),
            size_hint_x=0.35, halign="right"
        ))
        row.add_widget(MDLabel(
            text=f"{pct:.1f}%",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_x=0.25, halign="right"
        ))
        return row

    def _txn_row(self, t, s):
        color = GREEN if t["type"] == "income" else RED
        sign = "+" if t["type"] == "income" else "-"
        row = MDCard(
            orientation="horizontal",
            radius=[6], elevation=0,
            padding=[dp(12), dp(8)],
            size_hint_y=None, height=dp(56),
            md_bg_color=_c(PANEL), spacing=dp(8)
        )
        info = MDBoxLayout(
            orientation="vertical", size_hint_x=0.7)
        info.add_widget(MDLabel(
            text=t["category"],
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT), size_hint_y=0.6
        ))
        info.add_widget(MDLabel(
            text=t["note"] or t["date"],
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM), size_hint_y=0.4
        ))
        row.add_widget(info)
        row.add_widget(MDLabel(
            text=f"{sign}{s}{t['amount']:,.2f}",
            font_style="Body1",
            theme_text_color="Custom",
            text_color=_c(color),
            halign="right",
            size_hint_x=0.3,
            bold=True
        ))
        return row

    def _goal_row(self, g, s):
        pct = min(100, (g["current"] / g["target"] * 100)
                  if g["target"] > 0 else 0)
        card = MDCard(
            orientation="vertical",
            radius=[8], elevation=0,
            padding=dp(12),
            size_hint_y=None, height=dp(72),
            md_bg_color=_c(PANEL)
        )
        top = MDBoxLayout(orientation="horizontal")
        top.add_widget(MDLabel(
            text=g["title"],
            font_style="Body2",
            theme_text_color="Custom",
            text_color=_c(TEXT)
        ))
        top.add_widget(MDLabel(
            text=f"{s}{g['current']:,.0f} / {s}{g['target']:,.0f}",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(GOLD),
            halign="right"
        ))
        card.add_widget(top)
        card.add_widget(MDLabel(
            text=f"Progress: {pct:.1f}%",
            font_style="Caption",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(20)
        ))
        return card

    def _section(self, text):
        return MDLabel(
            text=text,
            font_style="Overline",
            theme_text_color="Custom",
            text_color=_c(TEXT_DIM),
            size_hint_y=None, height=dp(28)
        )

    def _go_add(self, type_):
        app = App.get_running_app()
        app.pending_txn_type = type_
        self.manager.current = "add_transaction"


class AddTransactionScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")
        self.selected_category = None
        self.menu = None

    def on_enter(self):
        self.clear_widgets()
        app = App.get_running_app()
        self.ctrl = FinancialController(app.db)
        self.type_ = getattr(app, "pending_txn_type", "expense")
        self._build()

    def _build(self):
        color = GREEN if self.type_ == "income" else RED
        cats = (INCOME_CATEGORIES if self.type_ == "income"
                else EXPENSE_CATEGORIES)
        self.selected_category = cats[0]

        title = ("ADD INCOME" if self.type_ == "income"
                 else "ADD EXPENSE")
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, title, color, back_screen="financial"))

        body = MDBoxLayout(
            orientation="vertical",
            padding=dp(20), spacing=dp(16)
        )
        self.amount_field = MDTextField(
            hint_text=f"Amount ({CURRENCY_SYMBOL})",
            input_filter="float",
            mode="rectangle"
        )
        self.cat_btn = MDRaisedButton(
            text=f"Category: {self.selected_category}",
            md_bg_color=_c(PANEL),
            size_hint_y=None, height=dp(44)
        )
        self.cat_btn.bind(
            on_release=self._open_category_menu)
        self.note_field = MDTextField(
            hint_text="Note (optional)",
            mode="rectangle"
        )
        save_btn = MDRaisedButton(
            text="SAVE",
            md_bg_color=_c(color),
            size_hint_y=None, height=dp(48)
        )
        save_btn.bind(on_release=self._save)

        body.add_widget(self.amount_field)
        body.add_widget(self.cat_btn)
        body.add_widget(self.note_field)
        body.add_widget(save_btn)
        root.add_widget(body)
        self.add_widget(root)

        menu_items = [
            {
                "text": c,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=c: self._set_category(x)
            }
            for c in cats
        ]
        self.menu = MDDropdownMenu(
            caller=self.cat_btn,
            items=menu_items,
            width_mult=4
        )

    def _open_category_menu(self, *args):
        self.menu.open()

    def _set_category(self, cat):
        self.selected_category = cat
        self.cat_btn.text = f"Category: {cat}"
        self.menu.dismiss()

    def _save(self, *args):
        amount = self.amount_field.text.strip()
        note = self.note_field.text.strip()
        if self.type_ == "income":
            ok, msg = self.ctrl.add_income(
                amount, self.selected_category, note)
        else:
            ok, msg = self.ctrl.add_expense(
                amount, self.selected_category, note)
        if ok:
            self.manager.current = "financial"
        else:
            self.amount_field.error = True
            self.amount_field.helper_text = msg
            self.amount_field.helper_text_mode = "on_error"


class TransactionHistoryScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = _c("#050810")

    def on_enter(self):
        self.clear_widgets()
        app = App.get_running_app()
        self.ctrl = FinancialController(app.db)
        self._build()

    def _build(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "ALL TRANSACTIONS",
                    ORANGE, back_screen="financial"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=dp(12),
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        txns = self.ctrl.get_recent_transactions(200)
        s = CURRENCY_SYMBOL

        if not txns:
            body.add_widget(MDLabel(
                text="No transactions yet.",
                theme_text_color="Custom",
                text_color=_c(TEXT_DIM),
                halign="center"
            ))
        else:
            for t in txns:
                color = GREEN if t["type"] == "income" else RED
                sign = "+" if t["type"] == "income" else "-"
                row = MDCard(
                    orientation="horizontal",
                    radius=[6], elevation=0,
                    padding=[dp(12), dp(8)],
                    size_hint_y=None, height=dp(56),
                    md_bg_color=_c(PANEL), spacing=dp(8)
                )
                info = MDBoxLayout(
                    orientation="vertical", size_hint_x=0.65)
                info.add_widget(MDLabel(
                    text=t["category"],
                    font_style="Body2",
                    theme_text_color="Custom",
                    text_color=_c(TEXT), size_hint_y=0.55
                ))
                info.add_widget(MDLabel(
                    text=f"{t['date']}  {t['note'] or ''}",
                    font_style="Caption",
                    theme_text_color="Custom",
                    text_color=_c(TEXT_DIM), size_hint_y=0.45
                ))
                row.add_widget(info)
                row.add_widget(MDLabel(
                    text=f"{sign}{s}{t['amount']:,.2f}",
                    font_style="Body1",
                    theme_text_color="Custom",
                    text_color=_c(color),
                    halign="right",
                    size_hint_x=0.35,
                    bold=True
                ))
                body.add_widget(row)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

