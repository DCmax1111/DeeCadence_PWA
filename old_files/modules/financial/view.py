from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.card import MDCard
from kivy.uix.widget import Widget
from kivy.app import App
from kivy.metrics import dp
from modules.financial.controller import FinancialController
from shared.theme import (
    c, t, hex_color, get_rank,
    CURRENCY_SYMBOL, INCOME_CATEGORIES,
    EXPENSE_CATEGORIES, R
)
from shared.components import (
    top_nav, section_label, log_row,
    empty_state, spacer, summary_card,
    input_field, primary_btn, ghost_btn
)


def _c(h): return hex_color(h)
GREEN    = t("financial")
RED      = t("error")
ORANGE   = t("financial")
GOLD     = t("spirit")
ACCENT   = t("accent")
TEXT     = t("text")
TEXT_DIM = t("text2")
PANEL    = t("card")


class FinancialScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self._built = False
        self._summary_container = None
        self._breakdown_container = None
        self._txn_container = None
        self._goal_container = None

    def on_enter(self):
        self.md_bg_color = c("bg")
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
        root.add_widget(
            top_nav(self, "Financial", "financial"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=[dp(16), dp(14), dp(16), dp(24)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        # Summary row
        self._summary_container = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(80)
        )
        self._fill_summary()
        body.add_widget(self._summary_container)
        body.add_widget(spacer(8))

        # Action buttons
        btn_row = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(10),
            size_hint_y=None, height=dp(52)
        )
        inc_btn = MDRaisedButton(
            text="+ Income",
            md_bg_color=_c(t("financial")),
            size_hint_x=0.5,
            height=dp(52)
        )
        inc_btn.bind(
            on_release=lambda x: self._go_add("income"))
        exp_btn = MDRaisedButton(
            text="+ Expense",
            md_bg_color=_c(t("error")),
            size_hint_x=0.5,
            height=dp(52)
        )
        exp_btn.bind(
            on_release=lambda x: self._go_add("expense"))
        btn_row.add_widget(inc_btn)
        btn_row.add_widget(exp_btn)
        body.add_widget(btn_row)
        body.add_widget(spacer(8))

        # Breakdown
        body.add_widget(
            section_label("EXPENSE BREAKDOWN",
                         top_space=False))
        self._breakdown_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(4), size_hint_y=None)
        self._breakdown_container.bind(
            minimum_height=self._breakdown_container
            .setter("height"))
        self._fill_breakdown()
        body.add_widget(self._breakdown_container)

        # Transactions
        body.add_widget(
            section_label("RECENT TRANSACTIONS"))
        self._txn_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._txn_container.bind(
            minimum_height=self._txn_container
            .setter("height"))
        self._fill_transactions()
        body.add_widget(self._txn_container)

        hist_btn = MDFlatButton(
            text="View all transactions >",
            theme_text_color="Custom",
            text_color=_c(t("accent")),
            size_hint_y=None, height=dp(40)
        )
        hist_btn.bind(on_release=lambda x: setattr(
            self.manager, "current",
            "transaction_history"))
        body.add_widget(hist_btn)

        # Goals
        body.add_widget(section_label("GOALS"))
        self._goal_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6), size_hint_y=None)
        self._goal_container.bind(
            minimum_height=self._goal_container
            .setter("height"))
        self._fill_goals()
        body.add_widget(self._goal_container)

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

    def _fill_summary(self):
        self._summary_container.clear_widgets()
        data = self.ctrl.get_dashboard_data()
        s = data["symbol"]
        cf_color = ("financial"
                    if data['cashflow'] >= 0
                    else "error")
        for label, val, ck in [
            ("INCOME",
             f"{s}{data['income']:,.0f}", "financial"),
            ("EXPENSES",
             f"{s}{data['expenses']:,.0f}", "error"),
            ("CASHFLOW",
             f"{s}{data['cashflow']:,.0f}", cf_color),
        ]:
            self._summary_container.add_widget(
                summary_card(label, val, ck))

    def _fill_breakdown(self):
        self._breakdown_container.clear_widgets()
        breakdown = self.ctrl.get_expense_breakdown()
        if not breakdown:
            self._breakdown_container.add_widget(
                empty_state("No expenses this month"))
            return
        total = sum(v for _, v in breakdown)
        s = CURRENCY_SYMBOL
        for cat, amt in breakdown:
            pct = (amt / total * 100) if total > 0 else 0
            row = MDBoxLayout(
                orientation="horizontal",
                size_hint_y=None, height=dp(28),
                spacing=dp(8)
            )
            row.add_widget(MDLabel(
                text=cat, font_style="Body2",
                theme_text_color="Custom",
                text_color=c("text"),
                size_hint_x=0.45
            ))
            row.add_widget(MDLabel(
                text=f"{s}{amt:,.2f}",
                font_style="Body2",
                theme_text_color="Custom",
                text_color=_c(t("error")),
                size_hint_x=0.35,
                halign="right"
            ))
            row.add_widget(MDLabel(
                text=f"{pct:.1f}%",
                font_style="Caption",
                theme_text_color="Custom",
                text_color=c("text3"),
                size_hint_x=0.2,
                halign="right"
            ))
            self._breakdown_container.add_widget(row)

    def _fill_transactions(self):
        self._txn_container.clear_widgets()
        txns = self.ctrl.get_recent_transactions(8)
        s = CURRENCY_SYMBOL
        if not txns:
            self._txn_container.add_widget(
                empty_state(
                    "No transactions yet",
                    "Tap + Income or + Expense to start"))
            return
        for tx in txns:
            ck = ("financial"
                  if tx["type"] == "income"
                  else "error")
            sign = "+" if tx["type"] == "income" else "-"
            self._txn_container.add_widget(
                log_row(
                    tx["category"],
                    f"{sign}{s}{tx['amount']:,.2f}"
                    f"  ·  {tx['date']}",
                    ck
                ))

    def _fill_goals(self):
        self._goal_container.clear_widgets()
        goals = self.ctrl.get_goals()
        s = CURRENCY_SYMBOL
        if not goals:
            self._goal_container.add_widget(
                empty_state("No goals set yet"))
            return
        for g in goals:
            pct = min(100,
                      (g["current"] / g["target"] * 100)
                      if g["target"] > 0 else 0)
            self._goal_container.add_widget(
                log_row(
                    g["title"],
                    f"{s}{g['current']:,.0f} / "
                    f"{s}{g['target']:,.0f}"
                    f"  ·  {pct:.1f}%",
                    "spirit"
                ))

    def _go_add(self, type_):
        app = App.get_running_app()
        app.pending_txn_type = type_
        self.manager.current = "add_transaction"

    def _section(self, text):
        return section_label(text, top_space=False)


class AddTransactionScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")
        self.selected_category = None
        self.menu = None

    def on_enter(self):
        self.clear_widgets()
        self.md_bg_color = c("bg")
        app = App.get_running_app()
        self.ctrl = FinancialController(app.db)
        self.type_ = getattr(
            app, "pending_txn_type", "expense")
        self._build()

    def _build(self):
        ck = ("financial" if self.type_ == "income"
              else "error")
        cats = (INCOME_CATEGORIES
                if self.type_ == "income"
                else EXPENSE_CATEGORIES)
        self.selected_category = cats[0]
        title = ("Add Income"
                 if self.type_ == "income"
                 else "Add Expense")

        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, title, ck,
                   back_screen="financial"))

        body = MDBoxLayout(
            orientation="vertical",
            padding=[dp(20), dp(20)],
            spacing=dp(16)
        )

        self.amount_field = input_field(
            f"Amount ({CURRENCY_SYMBOL})",
            input_filter="float")
        body.add_widget(self.amount_field)

        self.cat_btn = MDRaisedButton(
            text=f"Category: {self.selected_category}",
            md_bg_color=c("card"),
            size_hint_y=None, height=dp(52)
        )
        self.cat_btn.bind(
            on_release=self._open_menu)
        body.add_widget(self.cat_btn)

        self.note_field = input_field("Note (optional)")
        body.add_widget(self.note_field)

        save_btn = MDRaisedButton(
            text="SAVE",
            md_bg_color=_c(t(ck)),
            size_hint_y=None, height=dp(52)
        )
        save_btn.bind(on_release=self._save)
        body.add_widget(save_btn)

        root.add_widget(body)
        self.add_widget(root)

        menu_items = [
            {
                "text": c_,
                "viewclass": "OneLineListItem",
                "on_release": lambda x=c_:
                    self._set_cat(x)
            }
            for c_ in cats
        ]
        self.menu = MDDropdownMenu(
            caller=self.cat_btn,
            items=menu_items,
            width_mult=4
        )

    def _open_menu(self, *args):
        self.menu.open()

    def _set_cat(self, cat):
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


class TransactionHistoryScreen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = c("bg")

    def on_enter(self):
        self.clear_widgets()
        self.md_bg_color = c("bg")
        app = App.get_running_app()
        self.ctrl = FinancialController(app.db)
        self._build()

    def _build(self):
        root = MDBoxLayout(orientation="vertical")
        root.add_widget(
            top_nav(self, "All Transactions",
                   "financial",
                   back_screen="financial"))

        scroll = MDScrollView()
        body = MDBoxLayout(
            orientation="vertical",
            spacing=dp(6),
            padding=[dp(16), dp(14)],
            size_hint_y=None
        )
        body.bind(minimum_height=body.setter("height"))

        txns = self.ctrl.get_recent_transactions(200)
        s = CURRENCY_SYMBOL
        if not txns:
            body.add_widget(empty_state(
                "No transactions yet"))
        else:
            for tx in txns:
                ck = ("financial"
                      if tx["type"] == "income"
                      else "error")
                sign = ("+"
                        if tx["type"] == "income"
                        else "-")
                body.add_widget(log_row(
                    tx["category"],
                    f"{sign}{s}{tx['amount']:,.2f}"
                    f"  ·  {tx['date']}"
                    f"  ·  {tx['note'] or ''}",
                    ck
                ))

        scroll.add_widget(body)
        root.add_widget(scroll)
        self.add_widget(root)

