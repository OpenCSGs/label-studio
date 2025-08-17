"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
from urllib.parse import quote

from core.feature_flags import flag_set
from core.middleware import enforce_csrf_checks
from core.utils.common import load_func
from django.conf import settings
from django.contrib import auth
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect, render, reverse
from django.utils.http import url_has_allowed_host_and_scheme
from organizations.forms import OrganizationSignupForm
from organizations.models import Organization
from rest_framework.authtoken.models import Token
from users import forms
from users.functions import login, proceed_registration
from django.contrib.auth import get_user_model
# from models import User
from django.http import JsonResponse
from rest_framework import status
from rest_framework.response import Response
logger = logging.getLogger()



# http://127.0.0.1:8080/user/login1/?email=2184329322@qq.com
# http://127.0.0.1:8080/user/login1/?email=21843293212@qq.com
# http://127.0.0.1:8080/user/login1/?email=21843293211112@qq.com

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
    # print(request,100*'*')
    user = request.user
    next_page = request.GET.get('next')

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
                # Set the session to expire when the browser is closed
                request.session['keep_me_logged_in'] = False
                request.session.set_expiry(0)

            # user is organization member
            org_pk = Organization.find_by_user(user).pk
            user.active_organization_id = org_pk
            user.save(update_fields=['active_organization'])
            return redirect(next_page)

    if flag_set('fflag_feat_front_lsdv_e_297_increase_oss_to_enterprise_adoption_short'):
        return render(request, 'users/new-ui/user_login.html', {'form': form, 'next': quote(next_page)})

    return render(request, 'users/user_login.html', {'form': form, 'next': quote(next_page)})


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

import requests
from urllib.parse import urljoin, quote
import time
import webbrowser
class LabelStudioUserManager:
    def __init__(self, base_url='http://127.0.0.1:8080'):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.fixed_password = "han3035572473"
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

    def _get_csrf_token(self, url_path='/user/login/'):
        url = urljoin(self.base_url, url_path)
        try:
            response = self.session.get(url, timeout=5)
            response.raise_for_status()
            return response.cookies.get('csrftoken')
        except requests.RequestException as e:
            return None

    def _create_user(self, email, ):
        signup_url = urljoin(self.base_url, '/user/signup/')
        csrf_token = self._get_csrf_token('/user/signup/')

        if not csrf_token:
            return False

        form_data = {
            'email': email,
            'password': self.fixed_password,
            'password_confirm': self.fixed_password,
            'first_name': '',
            'last_name': '',
            'csrfmiddlewaretoken': csrf_token
        }

        try:
            response = self.session.post(
                signup_url,
                data=form_data,
                headers={'Referer': signup_url},
                allow_redirects=False,
                timeout=5
            )
            print(response)
            if response.status_code == 302:
                return True
            return False
        except requests.RequestException as e:
            return False


from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def login_verfy(request):
    """Login page with GET parameter support"""

    print(request,100*'=')
    print(dict(request.GET),100*'=')
    print(request.headers)
    print("POST:", dict(request.POST))
    # request.session.flush()


    next_page = request.GET.get('next')
    email = request.GET.get('email')
    # User = get_user_model()
    # print("创建用户是否存在", email, User.objects.filter(email=email).exists())
    # user = User.objects.get(email=email)
    # print("创建用户是否存在", email,user.get_username() )
    # username = User.objects.filter(email=email).values_list('username', flat=True).first()
    # print("创建用户是否存在", email,username)
    # print(email,100*'*')
    # 处理POST数据（如果有）


    # 可以在这里处理token_data
    # print(set_data(token_data['user_name'], token_data))
    from .models import User
    # token_data=eval(token_data)
    user = request.user
    # 设置默认重定向页面
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        next_page = reverse('projects:project-index')

    # 如果用户已认证且邮箱匹配，直接重定向
    User = get_user_model()
    if user.is_authenticated:
        # from django.contrib.auth import get_user_model
        """检查用户是否存在"""
        # User = get_user_model()
        print("创建用户是否存在:用户已认证且邮箱匹配", email, User.objects.filter(email=email).exists())
        if user.is_authenticated and email and user.email != email:
            auth.logout(request)
            return user_login1(request)  # 递归调用
        token_data = request.POST.dict()
        print(token_data)
        if token_data:
            User = get_user_model()
            user = User.objects.get(email=email)
            user.user_token = token_data.get('user_token', {})
            user.authorization = token_data.get('authorization', {})
            user.user_name = token_data.get('user_name', {})
            user.save()
            logger.info(f"保持数据成功: {token_data}")
        # return redirect(next_page)
        return JsonResponse({
                                        'status': 'success',
                                        'message': '用户认证成功',
                                        'next_page': next_page,
                                        'user': {
                                            'email': user.email,
                                            'id': user.id
                                        }
                                            }, status=200)


    # 获取服务器URL
    server_url = request.build_absolute_uri('/')[:-1]

    try:
        User = get_user_model()
        print("创建用户1")
        # 尝试获取用户
        try:
            print("创建用户2")
            user = User.objects.get(email=email)
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            user.save(update_fields=['active_organization'])
            token_data = request.POST.dict()
            print(token_data)
            if token_data:

                user.user_token = token_data.get('user_token', {})
                user.authorization = token_data.get('authorization', {})
                user.user_name = token_data.get('user_name', {})
                user.save()
                logger.info(f"保持数据成功: {token_data}")
            # return redirect(next_page)
            return JsonResponse({
                                        'status': 'success',
                                        'message': '用户获取成功',
                                        'next_page': next_page,
                                        'user': {
                                            'email': user.email,
                                            'id': user.id
                                        }
                                            }, status=200)
        except User.DoesNotExist:
            # 用户不存在，尝试创建
            print("创建用户不存在", email, User.objects.filter(email=email).exists())
            print("创建用户3")
            manager = LabelStudioUserManager(server_url)
            test_users = {"email": email}
            result = manager._create_user(**test_users)

            if result:
                # 创建成功，登录用户
                user = User.objects.get(email=email)
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                user.save(update_fields=['active_organization'])
                token_data = request.POST.dict()
                print(token_data)
                if token_data:
                    User = get_user_model()
                    user = User.objects.get(email=email)
                    user.user_token = token_data.get('user_token', {})
                    user.authorization = token_data.get('authorization', {})
                    user.user_name = token_data.get('user_name', {})
                    user.save()
                    logger.info(f"保持数据成功: {token_data}")
                return JsonResponse({
                                        'status': 'success',
                                        'message': '用户创建并登录成功',
                                        'next_page': next_page,
                                        'user': {
                                            'email': user.email,
                                            'id': user.id
                                        }
                                            }, status=200)
            else:
                # 创建失败，返回错误页面
                return render(request, 'users/user_login.html', {
                    'form': load_func(settings.USER_LOGIN_FORM)(),
                    'next': quote(next_page),
                    'error_message': "账号创建失败"
                }, status=400)

    except Exception as e:
        print("创建用户4")
        logger.error(str(e))
        # 返回错误页面
        return render(request, 'users/user_login.html', {
            'form': load_func(settings.USER_LOGIN_FORM)(),
            'next': quote(next_page),
            'error_message': "登录过程中发生错误"
        }, status=500)


@csrf_exempt
def login_reques(request):
    """Login page with GET parameter support"""

    print(request,100*'=')
    print(dict(request.GET),100*'=')
    print(request.headers)
    print("POST:", dict(request.POST))
    # request.session.flush()


    next_page = request.GET.get('next')
    email = request.GET.get('email')
    # User = get_user_model()
    # print("创建用户是否存在", email, User.objects.filter(email=email).exists())
    # user = User.objects.get(email=email)
    # print("创建用户是否存在", email,user.get_username() )
    # username = User.objects.filter(email=email).values_list('username', flat=True).first()
    # print("创建用户是否存在", email,username)
    # print(email,100*'*')
    # 处理POST数据（如果有）


    # 可以在这里处理token_data
    # print(set_data(token_data['user_name'], token_data))
    from .models import User
    # token_data=eval(token_data)
    user = request.user
    # 设置默认重定向页面
    if not next_page or not url_has_allowed_host_and_scheme(url=next_page, allowed_hosts=request.get_host()):
        next_page = reverse('projects:project-index')

    # 如果用户已认证且邮箱匹配，直接重定向
    User = get_user_model()
    if user.is_authenticated:
        # from django.contrib.auth import get_user_model
        """检查用户是否存在"""
        # User = get_user_model()
        print("创建用户是否存在:用户已认证且邮箱匹配", email, User.objects.filter(email=email).exists())
        if user.is_authenticated and email and user.email != email:
            auth.logout(request)
            return login_reques(request)  # 递归调用
        token_data = request.POST.dict()
        print(token_data)
        if token_data:
            User = get_user_model()
            user = User.objects.get(email=email)
            user.user_token = token_data.get('user_token', {})
            user.authorization = token_data.get('authorization', {})
            user.user_name = token_data.get('user_name', {})
            user.save()
            logger.info(f"保持数据成功: {token_data}")
        return redirect(next_page)



    # 获取服务器URL
    server_url = request.build_absolute_uri('/')[:-1]

    try:
        User = get_user_model()
        print("创建用户1")
        # 尝试获取用户
        try:
            print("创建用户2")
            user = User.objects.get(email=email)
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            user.save(update_fields=['active_organization'])
            token_data = request.POST.dict()
            print(token_data)
            if token_data:

                user.user_token = token_data.get('user_token', {})
                user.authorization = token_data.get('authorization', {})
                user.user_name = token_data.get('user_name', {})
                user.save()
                logger.info(f"保持数据成功: {token_data}")
            return redirect(next_page)
        except User.DoesNotExist:
            # 用户不存在，尝试创建
            print("创建用户不存在", email, User.objects.filter(email=email).exists())
            print("创建用户3")
            manager = LabelStudioUserManager(server_url)
            test_users = {"email": email}
            result = manager._create_user(**test_users)

            if result:
                # 创建成功，登录用户
                user = User.objects.get(email=email)
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                user.save(update_fields=['active_organization'])
                token_data = request.POST.dict()
                print(token_data)
                if token_data:
                    User = get_user_model()
                    user = User.objects.get(email=email)
                    user.user_token = token_data.get('user_token', {})
                    user.authorization = token_data.get('authorization', {})
                    user.user_name = token_data.get('user_name', {})
                    user.save()
                    logger.info(f"保持数据成功: {token_data}")
                return redirect(next_page)

            else:
                # 创建失败，返回错误页面
                return render(request, 'users/user_login.html', {
                    'form': load_func(settings.USER_LOGIN_FORM)(),
                    'next': quote(next_page),
                    'error_message': "账号创建失败"
                }, status=400)

    except Exception as e:
        print("创建用户4")
        logger.error(str(e))
        # 返回错误页面
        return render(request, 'users/user_login.html', {
            'form': load_func(settings.USER_LOGIN_FORM)(),
            'next': quote(next_page),
            'error_message': "登录过程中发生错误"
        }, status=500)

