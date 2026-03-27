"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
from urllib.parse import quote

from core.feature_flags import flag_set
from core.middleware import enforce_csrf_checks
from core.utils.common import load_func
from django.conf import settings
from django.contrib import auth
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from django.shortcuts import redirect, render, reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from organizations.forms import OrganizationSignupForm
from organizations.models import Organization
from rest_framework.authtoken.models import Token
from users import forms
from users.functions import login, proceed_registration, save_user_db

logger = logging.getLogger()
User = get_user_model()


@login_required
def logout(request):
    auth.logout(request)

    if settings.LOGOUT_REDIRECT_URL:
        return redirect(settings.LOGOUT_REDIRECT_URL)

    if settings.HOSTNAME:
        redirect_url = settings.HOSTNAME
        if not redirect_url.endswith('/'):
            redirect_url += '/'
        return redirect(redirect_url)
    return redirect('/')


@enforce_csrf_checks
def user_signup(request):
    """Sign up page"""
    user = request.user
    next_page = request.GET.get('next')
    token = request.GET.get('token')

    # checks if the URL is a safe redirection.
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        if flag_set('fflag_all_feat_dia_1777_ls_homepage_short', user):
            next_page = reverse('main')
        else:
            next_page = reverse('projects:project-index')

    user_form = forms.UserSignupForm()
    organization_form = OrganizationSignupForm()

    if user.is_authenticated:
        return redirect(next_page)

    # make a new user
    if request.method == 'POST':
        organization = Organization.objects.first()
        if settings.DISABLE_SIGNUP_WITHOUT_LINK is True:
            if not (token and organization and token == organization.token):
                raise PermissionDenied()
        else:
            if token and organization and token != organization.token:
                raise PermissionDenied()

        user_form = forms.UserSignupForm(request.POST)
        organization_form = OrganizationSignupForm(request.POST)

        if user_form.is_valid():
            redirect_response = proceed_registration(request, user_form, organization_form, next_page)
            if redirect_response:
                return redirect_response

    if flag_set('fflag_feat_front_lsdv_e_297_increase_oss_to_enterprise_adoption_short'):
        return render(
            request,
            'users/new-ui/user_signup.html',
            {
                'user_form': user_form,
                'organization_form': organization_form,
                'next': quote(next_page),
                'token': token,
                'found_us_options': forms.FOUND_US_OPTIONS,
                'elaborate': forms.FOUND_US_ELABORATE,
            },
        )

    return render(
        request,
        'users/user_signup.html',
        {
            'user_form': user_form,
            'organization_form': organization_form,
            'next': quote(next_page),
            'token': token,
        },
    )


@enforce_csrf_checks
def user_login(request):
    """Login page"""
    user = request.user
    next_page = request.GET.get('next')
    language = (
        request.GET.get('lang') or request.GET.get('language')
        or request.POST.get('lang') or request.POST.get('language')
        or request.session.get('language', 'en')
    )
    request.session['language'] = language

    # checks if the URL is a safe redirection.
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        if flag_set('fflag_all_feat_dia_1777_ls_homepage_short', user):
            next_page = reverse('main')
        else:
            next_page = reverse('projects:project-index')

    login_form = load_func(settings.USER_LOGIN_FORM)
    form = login_form()

    if user.is_authenticated:
        return redirect(next_page)

    if request.method == 'POST':
        form = login_form(request.POST)
        if form.is_valid():
            user = form.cleaned_data['user']
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            if form.cleaned_data['persist_session'] is not True:
                request.session['keep_me_logged_in'] = False
                request.session.set_expiry(0)
            org = Organization.find_by_user(user)
            user.active_organization_id = org.pk
            user.save(update_fields=['active_organization'])
            return redirect(next_page)

    if flag_set('fflag_feat_front_lsdv_e_297_increase_oss_to_enterprise_adoption_short'):
        return render(
            request, 'users/new-ui/user_login.html', {'form': form, 'next': quote(next_page), 'language': language}
        )
    return render(request, 'users/user_login.html', {'form': form, 'next': quote(next_page), 'language': language})


@login_required
def user_account(request, sub_path=None):
    """
    Handle user account view and profile updates.

    This view displays the user's profile information and allows them to update
    it. It requires the user to be authenticated and have an active organization
    or an organization_pk in the session.

    Args:
        request (HttpRequest): The request object.
        sub_path (str, optional): A sub-path parameter for potential URL routing.
            Defaults to None.

    Returns:
        HttpResponse: Renders the user account template with user profile form,
            or redirects to 'main' if no active organization is found,
            or redirects back to user-account after successful profile update.

    Notes:
        - Authentication is required (enforced by @login_required decorator)
        - Retrieves the user's API token for display in the template
        - Form validation happens on POST requests
    """
    user = request.user

    if user.active_organization is None and 'organization_pk' not in request.session:
        return redirect(reverse('main'))

    form = forms.UserProfileForm(instance=user)
    token = Token.objects.get(user=user)

    if request.method == 'POST':
        form = forms.UserProfileForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            return redirect(reverse('user-account'))

    return render(
        request,
        'users/user_account.html',
        {'settings': settings, 'user': user, 'user_profile_form': form, 'token': token},
    )


# ---------- CSGHub 二开：模拟登录 ----------


class LabelStudioUserManager:
    """CSGHub 二开：服务端创建用户（直接调 save_user_db）。"""

    def _create_user_db(self, email, password=None):
        form_data = {'email': email, 'password': password or email}
        try:
            return save_user_db(form_data)
        except Exception as e:
            logger.exception("LabelStudioUserManager._create_user_db: %s", e)
            return None


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def login_verfy(request):
    """CSGHub 二开：校验并写库。GET 带 email；POST 可带 user_token/authorization/user_name。"""
    next_page = request.GET.get('next')
    email = request.GET.get('email')
    language = (
        request.GET.get('lang') or request.GET.get('language')
        or request.POST.get('lang') or request.POST.get('language')
        or 'zh'
    )
    if language and language.lower() != 'en':
        language = 'zh'
    request.session['language'] = language
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        next_page = reverse('projects:project-index')
    if not email:
        return JsonResponse({'status': 'error', 'message': '缺少 email 参数', 'next_page': next_page}, status=400)
    user = request.user
    if user.is_authenticated:
        if user.email != email:
            auth.logout(request)
            return login_verfy(request)
        token_data = request.POST.dict() if request.method == 'POST' else {}
        if token_data:
            user.user_token = token_data.get('user_token', '') or user.user_token
            user.authorization = token_data.get('authorization', '') or user.authorization
            user.user_name = token_data.get('user_name', '') or user.user_name
            user.save(update_fields=['user_token', 'authorization', 'user_name'])
        return JsonResponse(
            {'status': 'success', 'message': '用户认证成功', 'next_page': next_page, 'user': {'email': user.email, 'id': user.id}},
            status=200,
        )
    try:
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            manager = LabelStudioUserManager()
            if not manager._create_user_db(email):
                return render(
                    request, 'users/user_login.html',
                    {'form': load_func(settings.USER_LOGIN_FORM)(), 'next': quote(next_page), 'error_message': '账号创建失败'},
                    status=400,
                )
            user = User.objects.get(email=email)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        org = Organization.find_by_user(user)
        if org:
            user.active_organization_id = org.pk
            user.save(update_fields=['active_organization'])
        token_data = request.POST.dict() if request.method == 'POST' else {}
        if token_data:
            user.user_token = token_data.get('user_token', '')
            user.authorization = token_data.get('authorization', '')
            user.user_name = token_data.get('user_name', '')
            user.save(update_fields=['user_token', 'authorization', 'user_name'])
        return JsonResponse(
            {'status': 'success', 'message': '用户获取成功', 'next_page': next_page, 'language': language, 'user': {'email': user.email, 'id': user.id}},
            status=200,
        )
    except Exception as e:
        logger.exception("login_verfy: %s", e)
        return render(
            request, 'users/user_login.html',
            {'form': load_func(settings.USER_LOGIN_FORM)(), 'next': quote(next_page), 'error_message': '登录过程中发生错误', 'language': language},
            status=500,
        )


@csrf_exempt
@require_http_methods(['GET'])
def login_reques(request):
    """CSGHub 二开：写 session 的 origin/language 并重定向到 next。"""
    next_page = request.GET.get('next')
    email = request.GET.get('email')
    language = (
        request.GET.get('lang') or request.GET.get('language')
        or request.POST.get('lang') or request.POST.get('language')
        or 'zh'
    )
    if language and language.lower() != 'en':
        language = 'zh'
    request.session['language'] = language
    origin = request.GET.get('origin')
    if origin:
        request.session['origin'] = origin
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        next_page = reverse('projects:project-index')

    def add_origin_to_url(url):
        if origin:
            return f"{url}{'&' if '?' in url else '?'}origin={quote(origin)}"
        return url

    if request.user.is_authenticated:
        if email and request.user.email != email:
            auth.logout(request)
            return login_reques(request)
        return redirect(add_origin_to_url(next_page))
    if not email:
        return render(
            request, 'users/user_login.html',
            {'form': load_func(settings.USER_LOGIN_FORM)(), 'next': quote(next_page), 'error_message': '缺少 email 参数', 'language': language},
            status=400,
        )
    try:
        user = User.objects.get(email=email)
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        org = Organization.find_by_user(user)
        if org:
            user.active_organization_id = org.pk
            user.save(update_fields=['active_organization'])
        return redirect(add_origin_to_url(next_page))
    except User.DoesNotExist:
        return render(
            request, 'users/user_login.html',
            {'form': load_func(settings.USER_LOGIN_FORM)(), 'next': quote(next_page), 'error_message': '账号获取失败，用户不存在', 'origin': origin, 'language': language},
            status=400,
        )
    except Exception as e:
        logger.exception("login_reques: %s", e)
        return render(
            request, 'users/user_login.html',
            {'form': load_func(settings.USER_LOGIN_FORM)(), 'next': quote(next_page), 'error_message': '登录过程中发生错误', 'language': language, 'origin': origin},
            status=500,
        )
